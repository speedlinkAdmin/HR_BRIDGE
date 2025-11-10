// controllers/timesheet.controller.js
const xlsx = require('xlsx');
const db = require('../models');

class TimesheetController {
  // === Helper: Parse date to YYYY-MM-DD ===
parseDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

// === Helper: Parse time to HH:MM:SS ===
parseTime(timeStr) {
  if (!timeStr) return null;
  const d = new Date(`1970-01-01 ${timeStr}`);
  return isNaN(d.getTime()) ? null : d.toTimeString().split(' ')[0];
}

// === Helper: Calculate total hours (decimal) ===
calculateTotalHours(checkIn, checkOut) {
  if (!checkIn || !checkOut) return null;
  const inTime = new Date(`1970-01-01 ${checkIn}`);
  const outTime = new Date(`1970-01-01 ${checkOut}`);
  const diffHrs = (outTime - inTime) / (1000 * 60 * 60);
  return parseFloat(diffHrs.toFixed(2));
}

  // === Helper: Get employee by mapped_id ===
  async getEmployeeByMappedId(mappedId) {
    return await db.Employee.findOne({ where: { mapped_id: mappedId } });
  }
  

  // === MAIN UPLOAD HANDLER WITH FULL DEBUG LOGS ===
 uploadTimesheetWithSequelizeUpsert = async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      console.log('📁 Reading Excel file:', req.file.filename);
      const workbook = xlsx.readFile(req.file.path);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // 👇 Fix: skip title row, use row 2 as headers
      const data = xlsx.utils.sheet_to_json(worksheet, { range: 1 });

      console.log('📊 Total rows in Excel (after skipping title):', data.length);
      if (data.length > 0) {
        console.log('🔍 First row keys:', Object.keys(data[0]));
        console.log('🔍 First data row:', data[0]);
      }

      if (!data?.length) {
        return res.status(400).json({ error: 'No rows found in Excel file' });
      }

      const processed = [];
      const stats = { created: 0, updated: 0, skipped: 0 };

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        console.log(`\n--- Processing Row ${i + 1} ---`);

        const rawPersonnelId = row['Personnel ID'];
        console.log(`🧍 Raw Personnel ID: '${rawPersonnelId}' (type: ${typeof rawPersonnelId})`);

        if (rawPersonnelId == null || rawPersonnelId === '' || String(rawPersonnelId).trim() === '') {
          console.log('❌ Skipped - Empty or missing Personnel ID');
          stats.skipped++;
          continue;
        }

        const personnelId = Number(rawPersonnelId);
        if (isNaN(personnelId) || !Number.isInteger(personnelId)) {
          console.log(`❌ Skipped - Invalid Personnel ID: '${rawPersonnelId}'`);
          stats.skipped++;
          continue;
        }
        console.log(`✅ Cleaned Personnel ID: ${personnelId}`);

        // ✅ Now this works!
        const employee = await this.getEmployeeByMappedId(personnelId);
        if (!employee) {
          console.log(`❌ Skipped - Employee not found for mapped_id: ${personnelId}`);
          stats.skipped++;
          continue;
        }
        console.log(`✅ Found employee: ${employee.first_name} ${employee.last_name}`);

        const rawDate = row['Record Date'];
        const recordDate = this.parseDate(rawDate);
        if (!recordDate) {
          console.log(`❌ Skipped - Invalid date: '${rawDate}'`);
          stats.skipped++;
          continue;
        }

        const punchTimeStr = row['Punch Time'] || '';
        const punchTimes = String(punchTimeStr).split(';').map(t => t.trim()).filter(Boolean);
        if (punchTimes.length === 0) {
          console.log('❌ Skipped - No punch times');
          stats.skipped++;
          continue;
        }

        const check_in = this.parseTime(punchTimes[0]);
        if (!check_in) {
          console.log(`❌ Skipped - Invalid check-in: '${punchTimes[0]}'`);
          stats.skipped++;
          continue;
        }

        const check_out = this.parseTime(punchTimes[punchTimes.length - 1]);
        const total_hours = this.calculateTotalHours(check_in, check_out);

        const [timesheet, created] = await db.Timesheet.upsert({
          employee_id: employee.employee_id,
          date: recordDate,
          check_in,
          check_out,
          total_hours
        }, {
          conflictFields: ['employee_id', 'date']
        });

        const action = created ? 'created' : 'updated';
        if (created) stats.created++;
        else stats.updated++;

        processed.push({
          mapped_id: employee.mapped_id,
          employee_id: employee.employee_id,
          name: `${employee.first_name} ${employee.middle_name || ''} ${employee.last_name}`.trim(),
          date: recordDate,
          check_in,
          check_out,
          total_hours,
          action
        });

        console.log(`✅ ${action} timesheet`);
      }

      return res.json({
        success: true,
        message: 'Timesheet processed successfully',
        summary: stats,
        records: processed
      });

    } catch (error) {
      console.error('💥 FATAL ERROR:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };

  // You can keep other methods (getAllTimesheets, etc.) if needed




  // === Upload & process with manual UPSERT ===
  async uploadTimesheet(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const workbook = xlsx.readFile(req.file.path);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(worksheet);

      if (!data?.length) {
        return res.status(400).json({ error: 'No rows found in Excel file' });
      }

      const processed = [];
      const stats = { created: 0, updated: 0, skipped: 0 };

      for (const row of data) {
        const rawMappedId = row.mapped_id;
        const mappedId = Number.isInteger(rawMappedId) ? rawMappedId : parseInt(rawMappedId);

        if (isNaN(mappedId)) {
          stats.skipped++;
          continue;
        }

        const employee = await this.getEmployeeByMappedId(mappedId);
        if (!employee) {
          stats.skipped++;
          continue;
        }

        const date = this.parseDate(row.Date);
        const check_in = this.parseTime(row['Check In']);
        const check_out = this.parseTime(row['Check Out']);
        const total_hours = this.calculateTotalHours(check_in, check_out);

        if (!date) {
          stats.skipped++;
          continue;
        }

        const existing = await db.Timesheet.findOne({
          where: { employee_id: employee.employee_id, date }
        });

        let action;
        if (existing) {
          await db.Timesheet.update(
            { check_in, check_out, total_hours, updatedAt: new Date() },
            { where: { id: existing.id } }
          );
          action = 'updated';
          stats.updated++;
        } else {
          await db.Timesheet.create({
            employee_id: employee.employee_id,
            date,
            check_in,
            check_out,
            total_hours
          });
          action = 'created';
          stats.created++;
        }

        processed.push({
          mapped_id: employee.mapped_id,
          employee_id: employee.employee_id,
          name: `${employee.first_name} ${employee.middle_name || ''} ${employee.last_name}`.trim(),
          date,
          check_in,
          check_out,
          total_hours,
          action
        });
      }

      return res.json({
        success: true,
        message: 'Timesheet processed successfully',
        summary: stats,
        records: processed
      });

    } catch (error) {
      console.error('Upload error:', error);
      return res.status(500).json({ error: 'Failed to process timesheet' });
    }
  }

  // === Upload with Sequelize upsert (requires unique index on [employee_id, date]) ===
  // async uploadTimesheetWithSequelizeUpsert(req, res) {
  //   try {
  //     if (!req.file) {
  //       return res.status(400).json({ error: 'No file uploaded' });
  //     }

  //     const workbook = xlsx.readFile(req.file.path);
  //     const sheetName = workbook.SheetNames[0];
  //     const worksheet = workbook.Sheets[sheetName];
  //     const data = xlsx.utils.sheet_to_json(worksheet);

  //     if (!data?.length) {
  //       return res.status(400).json({ error: 'No rows found in Excel file' });
  //     }

  //     const processed = [];
  //     const stats = { created: 0, updated: 0, skipped: 0 };

  //     for (const row of data) {
  //       const rawMappedId = row.mapped_id;
  //       const mappedId = Number.isInteger(rawMappedId) ? rawMappedId : parseInt(rawMappedId);

  //       if (isNaN(mappedId)) {
  //         stats.skipped++;
  //         continue;
  //       }

  //       const employee = await this.getEmployeeByMappedId(mappedId);
  //       if (!employee) {
  //         stats.skipped++;
  //         continue;
  //       }

  //       const date = this.parseDate(row.Date);
  //       const check_in = this.parseTime(row['Check In']);
  //       const check_out = this.parseTime(row['Check Out']);
  //       const total_hours = this.calculateTotalHours(check_in, check_out);

  //       if (!date) {
  //         stats.skipped++;
  //         continue;
  //       }

  //       const [timesheet, created] = await db.Timesheet.upsert({
  //         employee_id: employee.employee_id,
  //         date,
  //         check_in,
  //         check_out,
  //         total_hours
  //       }, {
  //         conflictFields: ['employee_id', 'date']
  //       });

  //       const action = created ? 'created' : 'updated';
  //       if (created) stats.created++;
  //       else stats.updated++;

  //       processed.push({
  //         mapped_id: employee.mapped_id,
  //         employee_id: employee.employee_id,
  //         name: `${employee.first_name} ${employee.middle_name || ''} ${employee.last_name}`.trim(),
  //         date,
  //         check_in,
  //         check_out,
  //         total_hours,
  //         action
  //       });
  //     }

  //     return res.json({
  //       success: true,
  //       message: 'Timesheet processed with upsert',
  //       summary: stats,
  //       records: processed
  //     });

  //   } catch (error) {
  //     console.error('Upsert error:', error);
  //     return res.status(500).json({ error: 'Failed to upsert timesheet' });
  //   }
  // }

  // Inside TimesheetController class
  // async uploadTimesheetWithSequelizeUpsert(req, res) {
  //   try {
  //     if (!req.file) {
  //       return res.status(400).json({ error: 'No file uploaded' });
  //     }

  //     const workbook = xlsx.readFile(req.file.path);
  //     const sheetName = workbook.SheetNames[0];
  //     const worksheet = workbook.Sheets[sheetName];
  //     const data = xlsx.utils.sheet_to_json(worksheet);

  //     if (!data?.length) {
  //       return res.status(400).json({ error: 'No rows found in Excel file' });
  //     }

  //     const processed = [];
  //     const stats = { created: 0, updated: 0, skipped: 0 };

  //     for (const row of data) {
  //       // Get Personnel ID (this is your mapped_id)
  //       const rawPersonnelId = row['Personnel ID'];
  //       const personnelId = Number.isInteger(rawPersonnelId) ? rawPersonnelId : parseInt(rawPersonnelId);

  //       if (isNaN(personnelId)) {
  //         stats.skipped++;
  //         continue;
  //       }

  //       const employee = await this.getEmployeeByMappedId(personnelId);
  //       if (!employee) {
  //         stats.skipped++;
  //         continue;
  //       }

  //       // Parse Record Date
  //       const recordDate = this.parseDate(row['Record Date']);
  //       if (!recordDate) {
  //         stats.skipped++;
  //         continue;
  //       }

  //       // Parse Punch Time
  //       const punchTimeStr = row['Punch Time'] || '';
  //       const punchTimes = punchTimeStr.split(';').map(t => t.trim()).filter(Boolean);

  //       if (punchTimes.length === 0) {
  //         stats.skipped++;
  //         continue;
  //       }

  //       const check_in = this.parseTime(punchTimes[0]);
  //       const check_out = this.parseTime(punchTimes[punchTimes.length - 1]);

  //       if (!check_in) {
  //         stats.skipped++;
  //         continue;
  //       }

  //       const total_hours = this.calculateTotalHours(check_in, check_out);

  //       // UPSERT timesheet
  //       const [timesheet, created] = await db.Timesheet.upsert({
  //         employee_id: employee.employee_id,
  //         date: recordDate,
  //         check_in,
  //         check_out,
  //         total_hours
  //       }, {
  //         conflictFields: ['employee_id', 'date']
  //       });

  //       const action = created ? 'created' : 'updated';
  //       if (created) stats.created++;
  //       else stats.updated++;

  //       processed.push({
  //         mapped_id: employee.mapped_id,
  //         employee_id: employee.employee_id,
  //         name: `${employee.first_name} ${employee.middle_name || ''} ${employee.last_name}`.trim(),
  //         date: recordDate,
  //         check_in,
  //         check_out,
  //         total_hours,
  //         action,
  //         raw_punch_times: punchTimes // optional: for debugging
  //       });
  //     }

  //     return res.json({
  //       success: true,
  //       message: 'Timesheet processed successfully',
  //       summary: stats,
  //       records: processed
  //     });

  //   } catch (error) {
  //     console.error('Upload error:', error);
  //     return res.status(500).json({ error: 'Failed to process timesheet' });
  //   }
  // }

  // === Optional: Get all timesheets ===
  // async getAllTimesheets(req, res) {
  //   try {
  //     const timesheets = await db.Timesheet.findAll({
  //       include: [{
  //         model: db.Employee,
  //         as: 'employee',
  //         attributes: ['first_name', 'middle_name', 'last_name', 'mapped_id']
  //       }],
  //       order: [['date', 'DESC']]
  //     });
  //     res.json(timesheets);
  //   } catch (error) {
  //     res.status(500).json({ error: 'Failed to fetch timesheets' });
  //   }
  // }

  async getAllTimesheets(req, res) {
  try {
    const timesheets = await db.Timesheet.findAll({
      include: [{
        model: db.Employee,
        as: 'employee',
        attributes: ['first_name', 'middle_name', 'last_name']
      }],
      order: [['date', 'DESC'], ['created_at', 'DESC']]
    });

    const formatted = timesheets.map(t => ({
      id: t.id,
      employee_id: t.employee_id,
      employee_name: `${t.employee.first_name} ${t.employee.middle_name ? t.employee.middle_name + ' ' : ''}${t.employee.last_name}`.trim(),
      date: t.date,
      check_in: t.check_in,
      check_out: t.check_out,
      total_hours: t.total_hours,
      created_at: t.created_at,
      updated_at: t.updated_at
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching all timesheets:', error);
    res.status(500).json({ error: 'Failed to fetch timesheets' });
  }
}


async getTimesheetsByEmployee(req, res) {
  try {
    const { employee_id } = req.body;

    const timesheets = await db.Timesheet.findAll({
      where: { employee_id },
      include: [{
        model: db.Employee,
        as: 'employee',
        attributes: ['first_name', 'middle_name', 'last_name']
      }],
      order: [['date', 'DESC']]
    });

    if (!timesheets.length) {
      return res.status(404).json({ error: 'No timesheets found for this employee' });
    }

    const employee = timesheets[0].employee;
    const employee_name = `${employee.first_name} ${employee.middle_name ? employee.middle_name + ' ' : ''}${employee.last_name}`.trim();

    const formatted = timesheets.map(t => ({
      id: t.id,
      date: t.date,
      check_in: t.check_in,
      check_out: t.check_out,
      total_hours: t.total_hours
    }));

    res.json({
      employee_id,
      employee_name,
      timesheets: formatted
    });
  } catch (error) {
    console.error('Error fetching employee timesheets:', error);
    res.status(500).json({ error: 'Failed to fetch timesheets' });
  }
}

  // === Get timesheets for a specific employee ===
  // async getEmployeeTimesheets(req, res) {
  //   try {
  //     const { employee_id } = req.params;
  //     const timesheets = await db.Timesheet.findAll({
  //       where: { employee_id },
  //       order: [['date', 'ASC']]
  //     });
  //     res.json(timesheets);
  //   } catch (error) {
  //     res.status(500).json({ error: 'Failed to fetch employee timesheets' });
  //   }
  // }
}

module.exports = new TimesheetController();
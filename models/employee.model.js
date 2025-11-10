// models/Employee.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Employee = sequelize.define('Employee', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    employee_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    first_name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    middle_name: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    last_name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    mapped_id: { // ← NEW FIELD
      type: DataTypes.INTEGER,
      allowNull: true,
      unique: true // optional, if you want to enforce uniqueness
    }
  }, {
    tableName: 'employees',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  Employee.associate = function(models) {
    Employee.hasMany(models.Timesheet, {
      foreignKey: 'employee_id',
      sourceKey: 'employee_id',
      as: 'timesheets'
    });
  };

  return Employee;
};
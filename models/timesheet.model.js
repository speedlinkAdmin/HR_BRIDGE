const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Timesheet = sequelize.define('Timesheet', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    employee_id: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    check_in: {
      type: DataTypes.TIME,
      allowNull: true
    },
    check_out: {
      type: DataTypes.TIME,
      allowNull: true
    },
    total_hours: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    }
  }, {
    tableName: 'timesheets',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true, // This makes the combination unique
        fields: ['employee_id', 'date']
      },
      {
        fields: ['date']
      }
    ]
  });

  Timesheet.associate = function(models) {
    Timesheet.belongsTo(models.Employee, {
      foreignKey: 'employee_id',
      targetKey: 'employee_id',
      as: 'employee'
    });
  };

  return Timesheet;
};
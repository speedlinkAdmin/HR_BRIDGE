const app = require('./app');
const db = require('./models');

const PORT = process.env.PORT || 3000;

// Sync database and start server
const startServer = async () => {
  try {
    // Test database connection
    await db.sequelize.authenticate();
    console.log('✅ Database connection established.');

    // Sync all models with database
    await db.sequelize.sync({ force: false }); // Set force: true only in development to drop and recreate tables
    console.log('✅ Database synchronized.');

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 API available at http://localhost:${PORT}/api/timesheets`);
      console.log(`❤️  Health check at http://localhost:${PORT}/health`);
    });

  } catch (error) {
    console.error('❌ Unable to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  await db.sequelize.close();
  console.log('✅ Database connection closed.');
  process.exit(0);
});

startServer();
const { setupDatabase } = require('../src/config/db');
const { generateEnhancedReport } = require('../src/services/enhancedReportsService');
(async () => {
  try {
    await setupDatabase();
    const report = await generateEnhancedReport('daily', '2026-06-03');
    console.log('REPORT OK', report.machines.length, report.executiveSummary);
  } catch (err) {
    console.error('REPORT ERROR', err);
    console.error(err.stack);
  }
})();

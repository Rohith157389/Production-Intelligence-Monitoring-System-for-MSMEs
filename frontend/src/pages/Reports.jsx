import { useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Reports() {
  const { user } = useAuth();
  const isUserRole = user?.role === 'user';

  const [period, setPeriod] = useState('daily');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchReport = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/reports/${period}`, { params: { date } });
      setReport(res.data);
    } catch (err) {
      setError('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = () => {
    const token = localStorage.getItem('token');
    const selectedIndustry = localStorage.getItem('selectedIndustry');
    const headers = { Authorization: `Bearer ${token}` };
    if (selectedIndustry) {
      headers['x-industry'] = selectedIndustry;
    }
    const url = `/api/reports/pdf/${period}?date=${date}`;
    fetch(url, { headers })
      .then((res) => res.blob())
      .then((blob) => {
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `PMRS_Audit_${period}_${date}.pdf`;
        link.click();
        window.URL.revokeObjectURL(blobUrl);
      });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit Reports</h1>
        <p className="text-gray-500 text-sm mt-1">
          Detailed industrial reports with event analysis, performance metrics, and PDF export
        </p>
      </div>

      <div className="card flex flex-col sm:flex-row flex-wrap gap-4 items-end bg-white border border-gray-200 shadow-sm">
        <div>
          <label className="label">Report Period</label>
          <select className="input-field w-40" value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <div>
          <label className="label">Reference Date</label>
          <input type="date" className="input-field w-44" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <button onClick={fetchReport} className="btn-primary shadow-md hover:shadow-lg transition-all" disabled={loading}>
          {loading ? 'Generating...' : 'Generate Report'}
        </button>
        {report && (
          <button onClick={downloadPdf} className="btn-secondary border border-gray-300">
            Download PDF
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      {report && (
        <div className="bg-white p-8 md:p-14 border border-gray-200 shadow-2xl rounded-sm text-gray-800">
          
          {/* Document Header */}
          <div className="border-b-4 border-slate-800 pb-6 mb-10 flex flex-col md:flex-row justify-between items-end gap-4">
            <div>
              <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight uppercase">Production Audit</h1>
              <p className="text-xl text-slate-500 mt-2 font-light uppercase tracking-widest">{report.period} Report — {report.label}</p>
            </div>
            <div className="text-right text-sm text-slate-500 font-medium bg-slate-50 p-4 rounded border border-slate-100">
              <p>GENERATED: <span className="text-slate-800">{new Date(report.generatedAt).toLocaleString()}</span></p>
              <p>MACHINES MONITORED: <span className="text-slate-800">{report.executiveSummary?.totalMachines}</span></p>
              <p>TOTAL OUTPUT: <span className="text-slate-800">{report.executiveSummary?.totalProduction} units</span></p>
              <p>AVG EFFICIENCY: <span className="text-slate-800">{report.executiveSummary?.averageEfficiency}%</span></p>
            </div>
          </div>

          <div className="space-y-12">
            
            {/* Executive Summary */}
            <section>
              <h2 className="text-2xl font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">1. Executive Summary</h2>
              <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                <ul className="space-y-3 text-slate-700">
                  {(report.factoryObservations || []).map((o, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="text-primary-600 font-bold">→</span>
                      <span>{o}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* Factory Event Timeline */}
            {report.eventTimeline?.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">2. Factory Event Timeline</h2>
                <div className="space-y-0 max-h-96 overflow-y-auto border border-slate-200 rounded-lg bg-white">
                  {report.eventTimeline.map((ev, i) => (
                    <div key={i} className="flex flex-col sm:flex-row sm:gap-6 p-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                      <span className="text-slate-500 font-mono text-sm shrink-0 sm:w-40 pt-0.5">
                        {new Date(ev.startTime).toLocaleString()}
                      </span>
                      <div className="text-slate-800">
                        <span className="font-bold text-primary-700">{ev.machineName}</span>
                        <span className="mx-2 text-slate-300">|</span>
                        <span className="font-medium text-slate-700">{ev.eventType}</span>
                        <span className="ml-2 text-sm text-slate-500">({ev.durationMinutes} min)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Machine Details */}
            <section>
              <h2 className="text-2xl font-bold text-slate-800 mb-8 border-b border-slate-200 pb-2">3. Machine Audit Details</h2>
              
              <div className="space-y-16">
                {report.machines?.map((m, index) => (
                  <div key={m.productionSummary.machineId} className="relative">
                    {/* Machine Header */}
                    <div className="flex items-baseline gap-4 mb-6">
                      <span className="text-3xl font-black text-slate-300">3.{index + 1}</span>
                      <h3 className="text-2xl font-bold text-slate-900">{m.productionSummary.machineName}</h3>
                      <span className="text-sm font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded">
                        {m.productionSummary.machineId} · {m.productionSummary.department}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* Left Column */}
                      <div className="space-y-6">
                        <ReportSection title="Production Metrics">
                          <div className="grid grid-cols-2 gap-4">
                            <StatCard label="Total Output" value={m.productionSummary.productionCount} unit="units" />
                            <StatCard label="Efficiency" value={m.productionSummary.efficiencyPercent} unit="%" />
                            <StatCard label="Runtime" value={m.productionSummary.runtime} unit="min" />
                            <StatCard label="Idle / Down" value={`${m.productionSummary.idleTime} / ${m.productionSummary.downtime}`} unit="min" />
                          </div>
                        </ReportSection>

                        {!isUserRole && (
                          <ReportSection title="Performance Parameters">
                            <div className="grid grid-cols-2 gap-4">
                              <StatCard label="Avg Temp" value={m.machinePerformance.averageTemperature} unit="°C" />
                              <StatCard label="Max Temp" value={m.machinePerformance.maximumTemperature} unit="°C" />
                              <StatCard label="Avg Current" value={m.machinePerformance.averageCurrent} unit="A" />
                              <StatCard label="Max Current" value={m.machinePerformance.maximumCurrent} unit="A" />
                            </div>
                          </ReportSection>
                        )}
                        
                        <ReportSection title="Recurring Issues">
                          <div className="grid grid-cols-3 gap-2">
                            <MiniStat label="Stoppages" value={m.recurringIssueAnalysis.totalStoppages} />
                            <MiniStat label="Overloads" value={m.recurringIssueAnalysis.totalOverloadEvents} />
                            <MiniStat label="Power Faults" value={m.recurringIssueAnalysis.totalPowerIssues} />
                          </div>
                        </ReportSection>
                      </div>

                      {/* Right Column */}
                      <div className="space-y-6">
                        <ReportSection title="Key Observations">
                          <ul className="space-y-2 bg-primary-50 border border-primary-100 p-4 rounded-lg">
                            {m.observations.map((obs, i) => (
                              <li key={i} className="text-sm text-primary-900 flex gap-2 leading-relaxed">
                                <span className="text-primary-500 font-bold">•</span>
                                {obs}
                              </li>
                            ))}
                          </ul>
                        </ReportSection>

                        <ReportSection title="Event Log">
                          {m.eventAnalysis?.length === 0 ? (
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500 italic text-center">
                              No abnormal events recorded during this period.
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {m.eventAnalysis.map((ev, i) => (
                                <div key={i} className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                                  <div className="flex justify-between items-center mb-2">
                                    <span className="font-bold text-slate-800 text-sm">{ev.eventType}</span>
                                    <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                      {ev.durationMinutes}m
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-600 mb-2 leading-relaxed">
                                    {ev.observation}
                                  </p>
                                  {!isUserRole && (
                                    <div className="flex gap-3 text-xs font-mono text-slate-500 bg-slate-50 p-2 rounded">
                                      <span>{ev.sensorSnapshot.current}A</span>
                                      <span>{ev.sensorSnapshot.temperature}°C</span>
                                      <span>{ev.sensorSnapshot.voltage}V</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </ReportSection>
                      </div>
                    </div>
                    
                    {/* Divider between machines */}
                    {index < report.machines.length - 1 && (
                      <div className="mt-16 border-b-2 border-dashed border-slate-200"></div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="mt-16 pt-8 border-t border-slate-200 text-center">
            <p className="text-slate-500 text-sm mb-4 italic">End of Report Document. For offline records, please download the PDF version.</p>
            <button onClick={downloadPdf} className="btn-primary shadow-lg px-8 py-3 text-lg rounded-full">
              Download Official PDF Report
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportSection({ title, children }) {
  return (
    <div>
      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
        {title}
      </h4>
      {children}
    </div>
  );
}

function StatCard({ label, value, unit }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded p-3">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-slate-800">
        {value} <span className="text-sm font-normal text-slate-500">{unit}</span>
      </p>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="bg-white border border-slate-200 rounded p-2 text-center">
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}

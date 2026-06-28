import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const emptyForm = {
  machineId: '',
  machineName: '',
  machineType: '',
  department: '',
  installationDate: '',
  targetQuantity: 1000,
  ratedCurrent: 15,
  expectedCycleTimePerProduct: 60,
  parameters: {
    current: true,
    voltage: true,
    temperature: true,
    vibration: true,
    objectCount: true,
  },
};

export default function Machines() {
  const { isAdmin } = useAuth();
  const [machines, setMachines] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editingMachineId, setEditingMachineId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchMachines = async () => {
    try {
      const res = await api.get('/machines');
      setMachines(res.data);
    } catch (err) {
      setError('Failed to load machines');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMachines();
  }, []);

  const handleEdit = (m) => {
    setForm({
      machineId: m.machine_id,
      machineName: m.machine_name,
      machineType: m.machine_type,
      department: m.department,
      installationDate: m.installation_date ? m.installation_date.split('T')[0] : '',
      targetQuantity: m.target_quantity,
      ratedCurrent: m.rated_current,
      expectedCycleTimePerProduct: m.expected_cycle_time_seconds,
      parameters: (typeof m.parameters === 'string' ? JSON.parse(m.parameters) : m.parameters) || emptyForm.parameters,
    });
    setEditingMachineId(m.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancel = () => {
    setForm(emptyForm);
    setEditingMachineId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const payload = {
        machineName: form.machineName,
        machineType: form.machineType,
        department: form.department,
        installationDate: form.installationDate,
        targetQuantity: Number(form.targetQuantity),
        ratedCurrent: Number(form.ratedCurrent),
        expectedCycleTimePerProduct: Number(form.expectedCycleTimePerProduct),
        parameters: form.parameters,
      };

      if (editingMachineId) {
        await api.put(`/machines/${editingMachineId}`, payload);
        setSuccess('Machine updated successfully');
      } else {
        await api.post('/machines', { ...payload, machineId: form.machineId });
        setSuccess('Machine registered successfully');
      }
      
      setForm(emptyForm);
      setEditingMachineId(null);
      setShowForm(false);
      fetchMachines();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save machine');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this machine?')) return;
    try {
      await api.delete(`/machines/${id}`);
      fetchMachines();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Machine Configuration</h1>
          <p className="text-gray-500 text-sm mt-1">Register and edit machines with production parameters</p>
        </div>
        {isAdmin && (
          <button onClick={showForm ? handleCancel : () => setShowForm(true)} className="btn-primary">
            {showForm ? 'Cancel' : '+ Add Machine'}
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
      )}
      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm">
          {success}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="ind-panel grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 border-b pb-2 mb-2">
            <h2 className="text-lg font-semibold text-gray-800">
              {editingMachineId ? `Edit Machine: ${form.machineId}` : 'Register New Machine'}
            </h2>
          </div>
          <div>
            <label className="label">Machine ID *</label>
            <input
              className="input-field disabled:bg-gray-100"
              value={form.machineId}
              onChange={(e) => setForm({ ...form, machineId: e.target.value })}
              placeholder="MCH-004"
              required
              disabled={!!editingMachineId}
            />
          </div>
          <div>
            <label className="label">Machine Name *</label>
            <input
              className="input-field"
              value={form.machineName}
              onChange={(e) => setForm({ ...form, machineName: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Machine Type *</label>
            <input
              className="input-field"
              value={form.machineType}
              onChange={(e) => setForm({ ...form, machineType: e.target.value })}
              placeholder="CNC Lathe"
              required
            />
          </div>
          <div>
            <label className="label">Department *</label>
            <input
              className="input-field"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              placeholder="Machining"
              required
            />
          </div>
          <div>
            <label className="label">Installation Date *</label>
            <input
              type="date"
              className="input-field"
              value={form.installationDate}
              onChange={(e) => setForm({ ...form, installationDate: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Target Production</label>
            <input type="number" className="input-field" value={form.targetQuantity} onChange={(e) => setForm({ ...form, targetQuantity: e.target.value })} />
          </div>
          <div>
            <label className="label">Rated Current (A)</label>
            <input type="number" step="0.1" className="input-field" value={form.ratedCurrent} onChange={(e) => setForm({ ...form, ratedCurrent: e.target.value })} />
          </div>
          <div>
            <label className="label">Expected Cycle Time (sec/product)</label>
            <input type="number" className="input-field" value={form.expectedCycleTimePerProduct} onChange={(e) => setForm({ ...form, expectedCycleTimePerProduct: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Tracked Parameters</label>
            <div className="flex flex-wrap gap-4 mt-2">
              {['current', 'voltage', 'temperature', 'vibration', 'objectCount'].map((param) => (
                <label key={param} className="flex items-center space-x-2 text-gray-700 text-sm">
                  <input
                    type="checkbox"
                    checked={form.parameters[param] || false}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        parameters: { ...form.parameters, [param]: e.target.checked },
                      })
                    }
                    className="rounded border-gray-300 bg-white text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="capitalize">{param.replace(/([A-Z])/g, ' $1').trim()}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="md:col-span-2 pt-4">
            <button type="submit" className="btn-primary w-full md:w-auto">
              {editingMachineId ? 'Save Changes' : 'Register Machine'}
            </button>
          </div>
        </form>
      )}

      <div className="ind-panel overflow-x-auto">
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : machines.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No machines registered yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="pb-3 pr-4">ID</th>
                <th className="pb-3 pr-4">Name</th>
                <th className="pb-3 pr-4">Type</th>
                <th className="pb-3 pr-4">Department</th>
                <th className="pb-3 pr-4">Installed</th>
                <th className="pb-3 pr-4">Rated A</th>
                <th className="pb-3 pr-4">Cycle (s)</th>
                {isAdmin && <th className="pb-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {machines.map((m) => (
                <tr key={m.id} className="border-b border-slate-100 hover:bg-gray-50 transition-colors">
                  <td className="py-3 pr-4 font-mono text-indigo-600 font-medium">{m.machine_id}</td>
                  <td className="py-3 pr-4 font-medium">{m.machine_name}</td>
                  <td className="py-3 pr-4 text-gray-600">{m.machine_type}</td>
                  <td className="py-3 pr-4 text-gray-600">{m.department}</td>
                  <td className="py-3 pr-4 text-gray-600">
                    {new Date(m.installation_date).toLocaleDateString()}
                  </td>
                  <td className="py-3 pr-4 font-mono text-gray-600">{m.rated_current ?? 15}A</td>
                  <td className="py-3 pr-4 font-mono text-gray-600">{m.expected_cycle_time_seconds ?? 60}s</td>
                  {isAdmin && (
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => handleEdit(m)}
                          className="text-indigo-600 hover:text-indigo-800 font-medium text-xs"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(m.id)}
                          className="text-red-600 hover:text-red-800 font-medium text-xs"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

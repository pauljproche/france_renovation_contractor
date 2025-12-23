import { createContext, useContext, useState, useEffect } from 'react';

const WorkersContext = createContext(undefined);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Demo workers data
const DEMO_WORKERS = [
  {
    id: 'worker-1',
    name: 'ANTONIO',
    email: '',
    phone: '',
    jobs: [
      {
        id: 'job-1-1',
        chantierName: 'LAMENNAIS',
        startDate: new Date('2025-09-08').toISOString(),
        endDate: new Date('2025-09-12').toISOString(),
        jobType: 'plumbing', // Will be shown on click later
      },
      {
        id: 'job-1-2',
        chantierName: 'WAGRAM',
        startDate: new Date('2025-09-17').toISOString(),
        endDate: new Date('2025-09-21').toISOString(),
        jobType: 'electrical',
      },
      {
        id: 'job-1-3',
        chantierName: 'RUEIL',
        startDate: new Date('2025-09-22').toISOString(),
        endDate: new Date('2025-09-26').toISOString(),
        jobType: 'demo',
      },
    ],
  },
  {
    id: 'worker-2',
    name: 'ARMENIO',
    email: '',
    phone: '',
    jobs: [
      {
        id: 'job-2-1',
        chantierName: 'LAUGIER',
        startDate: new Date('2025-09-02').toISOString(),
        endDate: new Date('2025-09-06').toISOString(),
        jobType: 'plumbing',
      },
      {
        id: 'job-2-2',
        chantierName: 'LAMENNAIS',
        startDate: new Date('2025-09-09').toISOString(),
        endDate: new Date('2025-09-13').toISOString(),
        jobType: 'electrical',
      },
      {
        id: 'job-2-3',
        chantierName: 'LISBONNE',
        startDate: new Date('2025-09-11').toISOString(),
        endDate: new Date('2025-09-15').toISOString(),
        jobType: 'demo',
      },
      {
        id: 'job-2-4',
        chantierName: 'WAGRAM',
        startDate: new Date('2025-09-12').toISOString(),
        endDate: new Date('2025-09-16').toISOString(),
        jobType: 'plumbing',
      },
      {
        id: 'job-2-5',
        chantierName: 'MEUDON',
        startDate: new Date('2025-09-19').toISOString(),
        endDate: new Date('2025-09-23').toISOString(),
        jobType: 'electrical',
      },
      {
        id: 'job-2-6',
        chantierName: 'ISLAM PEI',
        startDate: new Date('2025-09-15').toISOString(),
        endDate: new Date('2025-09-18').toISOString(),
        jobType: 'plumbing',
      },
      {
        id: 'job-2-7',
        chantierName: 'LAMENNAIS',
        startDate: new Date('2025-09-16').toISOString(),
        endDate: new Date('2025-09-20').toISOString(),
        jobType: 'electrical',
      },
      {
        id: 'job-2-8',
        chantierName: 'RUEIL',
        startDate: new Date('2025-09-22').toISOString(),
        endDate: new Date('2025-09-26').toISOString(),
        jobType: 'demo',
      },
      {
        id: 'job-2-9',
        chantierName: 'LISBONNE',
        startDate: new Date('2025-09-24').toISOString(),
        endDate: new Date('2025-09-28').toISOString(),
        jobType: 'plumbing',
      },
      {
        id: 'job-2-10',
        chantierName: 'PARQUET',
        startDate: new Date('2025-09-26').toISOString(),
        endDate: new Date('2025-09-30').toISOString(),
        jobType: 'electrical',
      },
      {
        id: 'job-2-11',
        chantierName: 'DAMESME',
        startDate: new Date('2025-09-25').toISOString(),
        endDate: new Date('2025-09-29').toISOString(),
        jobType: 'plumbing',
      },
      {
        id: 'job-2-12',
        chantierName: 'AQUEDUC',
        startDate: new Date('2025-09-30').toISOString(),
        endDate: new Date('2025-10-04').toISOString(),
        jobType: 'demo',
      },
      {
        id: 'job-2-13',
        chantierName: 'SCHWEBEL',
        startDate: new Date('2025-10-02').toISOString(),
        endDate: new Date('2025-10-06').toISOString(),
        jobType: 'electrical',
      },
    ],
  },
  {
    id: 'worker-3',
    name: 'FREDERIC',
    email: '',
    phone: '',
    jobs: [
      {
        id: 'job-3-1',
        chantierName: 'AUGIER',
        startDate: new Date('2025-08-18').toISOString(),
        endDate: new Date('2025-08-22').toISOString(),
        jobType: 'plumbing',
      },
      {
        id: 'job-3-2',
        chantierName: 'SW_CHWEBEL',
        startDate: new Date('2025-08-25').toISOString(),
        endDate: new Date('2025-08-29').toISOString(),
        jobType: 'electrical',
      },
      {
        id: 'job-3-3',
        chantierName: 'LAMENNAIS',
        startDate: new Date('2025-09-05').toISOString(),
        endDate: new Date('2025-09-09').toISOString(),
        jobType: 'demo',
      },
    ],
  },
  {
    id: 'worker-4',
    name: 'JEAN-PIERRE',
    email: '',
    phone: '',
    jobs: [
      {
        id: 'job-4-1',
        chantierName: 'WAGRAM',
        startDate: new Date('2025-09-01').toISOString(),
        endDate: new Date('2025-09-05').toISOString(),
        jobType: 'plumbing',
      },
      {
        id: 'job-4-2',
        chantierName: 'RUEIL',
        startDate: new Date('2025-09-08').toISOString(),
        endDate: new Date('2025-09-12').toISOString(),
        jobType: 'electrical',
      },
      {
        id: 'job-4-3',
        chantierName: 'MEUDON',
        startDate: new Date('2025-09-15').toISOString(),
        endDate: new Date('2025-09-19').toISOString(),
        jobType: 'demo',
      },
      {
        id: 'job-4-4',
        chantierName: 'PARQUET',
        startDate: new Date('2025-09-22').toISOString(),
        endDate: new Date('2025-09-26').toISOString(),
        jobType: 'plumbing',
      },
      {
        id: 'job-4-5',
        chantierName: 'AQUEDUC',
        startDate: new Date('2025-09-29').toISOString(),
        endDate: new Date('2025-10-03').toISOString(),
        jobType: 'electrical',
      },
    ],
  },
  {
    id: 'worker-5',
    name: 'MARCEL',
    email: '',
    phone: '',
    jobs: [
      {
        id: 'job-5-1',
        chantierName: 'LAUGIER',
        startDate: new Date('2025-09-03').toISOString(),
        endDate: new Date('2025-09-07').toISOString(),
        jobType: 'demo',
      },
      {
        id: 'job-5-2',
        chantierName: 'LAMENNAIS',
        startDate: new Date('2025-09-10').toISOString(),
        endDate: new Date('2025-09-14').toISOString(),
        jobType: 'plumbing',
      },
      {
        id: 'job-5-3',
        chantierName: 'LISBONNE',
        startDate: new Date('2025-09-17').toISOString(),
        endDate: new Date('2025-09-21').toISOString(),
        jobType: 'electrical',
      },
      {
        id: 'job-5-4',
        chantierName: 'DAMESME',
        startDate: new Date('2025-09-24').toISOString(),
        endDate: new Date('2025-09-28').toISOString(),
        jobType: 'demo',
      },
    ],
  },
  {
    id: 'worker-6',
    name: 'PIERRE',
    email: '',
    phone: '',
    jobs: [
      {
        id: 'job-6-1',
        chantierName: 'ISLAM PEI',
        startDate: new Date('2025-08-20').toISOString(),
        endDate: new Date('2025-08-24').toISOString(),
        jobType: 'plumbing',
      },
      {
        id: 'job-6-2',
        chantierName: 'SCHWEBEL',
        startDate: new Date('2025-09-05').toISOString(),
        endDate: new Date('2025-09-09').toISOString(),
        jobType: 'electrical',
      },
      {
        id: 'job-6-3',
        chantierName: 'WAGRAM',
        startDate: new Date('2025-09-12').toISOString(),
        endDate: new Date('2025-09-16').toISOString(),
        jobType: 'demo',
      },
      {
        id: 'job-6-4',
        chantierName: 'RUEIL',
        startDate: new Date('2025-09-19').toISOString(),
        endDate: new Date('2025-09-23').toISOString(),
        jobType: 'plumbing',
      },
      {
        id: 'job-6-5',
        chantierName: 'LAMENNAIS',
        startDate: new Date('2025-09-26').toISOString(),
        endDate: new Date('2025-09-30').toISOString(),
        jobType: 'electrical',
      },
      {
        id: 'job-6-6',
        chantierName: 'AQUEDUC',
        startDate: new Date('2025-10-03').toISOString(),
        endDate: new Date('2025-10-07').toISOString(),
        jobType: 'demo',
      },
    ],
  },
  {
    id: 'worker-7',
    name: 'CLAUDE',
    email: '',
    phone: '',
    jobs: [
      {
        id: 'job-7-1',
        chantierName: 'MEUDON',
        startDate: new Date('2025-09-01').toISOString(),
        endDate: new Date('2025-09-05').toISOString(),
        jobType: 'plumbing',
      },
      {
        id: 'job-7-2',
        chantierName: 'PARQUET',
        startDate: new Date('2025-09-04').toISOString(),
        endDate: new Date('2025-09-08').toISOString(),
        jobType: 'electrical',
      },
      {
        id: 'job-7-3',
        chantierName: 'DAMESME',
        startDate: new Date('2025-09-07').toISOString(),
        endDate: new Date('2025-09-11').toISOString(),
        jobType: 'demo',
      },
      {
        id: 'job-7-4',
        chantierName: 'AQUEDUC',
        startDate: new Date('2025-09-14').toISOString(),
        endDate: new Date('2025-09-18').toISOString(),
        jobType: 'plumbing',
      },
      {
        id: 'job-7-5',
        chantierName: 'SCHWEBEL',
        startDate: new Date('2025-09-21').toISOString(),
        endDate: new Date('2025-09-25').toISOString(),
        jobType: 'electrical',
      },
      {
        id: 'job-7-6',
        chantierName: 'LISBONNE',
        startDate: new Date('2025-09-28').toISOString(),
        endDate: new Date('2025-10-02').toISOString(),
        jobType: 'demo',
      },
      {
        id: 'job-7-7',
        chantierName: 'LAUGIER',
        startDate: new Date('2025-10-05').toISOString(),
        endDate: new Date('2025-10-09').toISOString(),
        jobType: 'plumbing',
      },
    ],
  },
];

// Load workers from localStorage
const loadWorkers = () => {
  try {
    const stored = localStorage.getItem('workers');
    if (stored) {
      const parsedWorkers = JSON.parse(stored);
      
      // Always ensure we have all demo workers (merge new ones if missing)
      const storedWorkerIds = new Set(parsedWorkers.map(w => w.id));
      const demoWorkerIds = new Set(DEMO_WORKERS.map(w => w.id));
      
      // If we're missing any demo workers, add them
      const missingWorkers = DEMO_WORKERS.filter(w => !storedWorkerIds.has(w.id));
      if (missingWorkers.length > 0) {
        // Merge: keep existing stored workers, add missing demo workers
        const merged = [...parsedWorkers];
        
        // Add missing workers
        missingWorkers.forEach(missingWorker => {
          merged.push(missingWorker);
        });
        
        // Sort by name for consistency
        merged.sort((a, b) => a.name.localeCompare(b.name));
        
        // Save the merged result back to localStorage
        try {
          localStorage.setItem('workers', JSON.stringify(merged));
        } catch (e) {
          console.warn('Failed to save merged workers:', e);
        }
        
        return merged;
      }
      
      return parsedWorkers;
    }
  } catch (e) {
    console.warn('Failed to load workers:', e);
  }
  return DEMO_WORKERS;
};

// Save workers to localStorage
const saveWorkers = (workers) => {
  try {
    localStorage.setItem('workers', JSON.stringify(workers));
  } catch (e) {
    console.warn('Failed to save workers:', e);
  }
};

export function WorkersProvider({ children }) {
  const [workers, setWorkers] = useState(() => loadWorkers());
  const [loading, setLoading] = useState(false);

  // Load workers from API on mount (with localStorage fallback)
  useEffect(() => {
    async function loadWorkersFromAPI() {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/workers`);
        if (response.ok) {
          const data = await response.json();
          const apiWorkers = data.workers || [];
          
          // Merge with demo workers (hardcoded, not in DB)
          const allWorkers = [...DEMO_WORKERS, ...apiWorkers];
          setWorkers(allWorkers);
          
          // Also save to localStorage for fallback
          saveWorkers(apiWorkers); // Only save non-demo workers
          
          setLoading(false);
          return;
        } else if (response.status === 501) {
          // Database not enabled - use localStorage fallback
          console.log('API returned 501 - database not enabled, using localStorage');
        }
      } catch (error) {
        // API not available or failed - use localStorage fallback
        console.log('API call failed, using localStorage fallback:', error);
      }
      
      // Fallback to localStorage (already loaded in initial state)
      setLoading(false);
    }

    loadWorkersFromAPI();
  }, []);

  // Save to localStorage whenever workers change (only non-demo workers)
  useEffect(() => {
    // Filter out demo workers before saving
    const nonDemoWorkers = workers.filter(
      (w) => !(w.id && w.id.startsWith('worker-') && w.id.replace('worker-', '').match(/^\d+$/))
    );
    saveWorkers(nonDemoWorkers);
  }, [workers]);

  // Update a specific worker
  const updateWorker = async (workerId, updates) => {
    // Don't update demo workers via API
    if (workerId && workerId.startsWith('worker-') && workerId.replace('worker-', '').match(/^\d+$/)) {
      // Update locally only (demo workers not in DB)
      setWorkers((prev) =>
        prev.map((worker) =>
          worker.id === workerId ? { ...worker, ...updates } : worker
        )
      );
      return;
    }
    
    // Try API first
    try {
      const response = await fetch(`${API_BASE_URL}/api/workers/${workerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (response.ok) {
        const updatedWorker = await response.json();
        setWorkers((prev) =>
          prev.map((worker) => worker.id === workerId ? updatedWorker : worker)
        );
        return;
      } else if (response.status === 501) {
        // Database not enabled - use localStorage
        console.log('API returned 501 - using localStorage');
      } else {
        throw new Error(`API error: ${response.status}`);
      }
    } catch (error) {
      console.log('API update failed, using localStorage:', error);
    }
    
    // Fallback to localStorage
    setWorkers((prev) =>
      prev.map((worker) =>
        worker.id === workerId ? { ...worker, ...updates } : worker
      )
    );
  };

  // Add a new job to a worker
  const addJobToWorker = async (workerId, job) => {
    const worker = workers.find((w) => w.id === workerId);
    if (!worker) return;
    
    const updatedJobs = [...(worker.jobs || []), job];
    // Update via API (updateWorker handles API/localStorage and state update)
    await updateWorker(workerId, { jobs: updatedJobs });
  };

  // Update a job for a worker
  const updateJob = async (workerId, jobId, updates) => {
    const worker = workers.find((w) => w.id === workerId);
    if (!worker) return;
    
    const updatedJobs = (worker.jobs || []).map((job) =>
      job.id === jobId ? { ...job, ...updates } : job
    );
    // Update via API (updateWorker handles API/localStorage and state update)
    await updateWorker(workerId, { jobs: updatedJobs });
  };

  // Delete a job from a worker
  const deleteJob = async (workerId, jobId) => {
    const worker = workers.find((w) => w.id === workerId);
    if (!worker) return;
    
    const updatedJobs = (worker.jobs || []).filter((job) => job.id !== jobId);
    // Update via API (updateWorker handles API/localStorage and state update)
    await updateWorker(workerId, { jobs: updatedJobs });
  };

  // Add a new worker
  const addWorker = async (worker) => {
    const newWorker = {
      id: `worker-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: worker.name || '',
      email: worker.email || '',
      phone: worker.phone || '',
      jobs: worker.jobs || [],
    };
    
    // Try API first
    try {
      const response = await fetch(`${API_BASE_URL}/api/workers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWorker)
      });
      
      if (response.ok) {
        const createdWorker = await response.json();
        setWorkers((prev) => [...prev, createdWorker]);
        return createdWorker;
      } else if (response.status === 501) {
        // Database not enabled - use localStorage
        console.log('API returned 501 - using localStorage');
      } else {
        throw new Error(`API error: ${response.status}`);
      }
    } catch (error) {
      console.log('API create failed, using localStorage:', error);
    }
    
    // Fallback to localStorage
    setWorkers((prev) => [...prev, newWorker]);
    return newWorker;
  };

  // Delete a worker
  const deleteWorker = async (workerId) => {
    // Don't allow deleting demo workers
    if (workerId && workerId.startsWith('worker-') && workerId.replace('worker-', '').match(/^\d+$/)) {
      return;
    }
    
    // Try API first
    try {
      const response = await fetch(`${API_BASE_URL}/api/workers/${workerId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setWorkers((prev) => prev.filter((worker) => worker.id !== workerId));
        return;
      } else if (response.status === 501) {
        // Database not enabled - use localStorage
        console.log('API returned 501 - using localStorage');
      } else {
        throw new Error(`API error: ${response.status}`);
      }
    } catch (error) {
      console.log('API delete failed, using localStorage:', error);
    }
    
    // Fallback to localStorage
    setWorkers((prev) => prev.filter((worker) => worker.id !== workerId));
  };

  return (
    <WorkersContext.Provider
      value={{
        workers,
        setWorkers,
        updateWorker,
        addJobToWorker,
        updateJob,
        deleteJob,
        addWorker,
        deleteWorker,
        loading,
      }}
    >
      {children}
    </WorkersContext.Provider>
  );
}

export function useWorkers() {
  const context = useContext(WorkersContext);
  if (context === undefined) {
    throw new Error('useWorkers must be used within WorkersProvider');
  }
  return context;
}



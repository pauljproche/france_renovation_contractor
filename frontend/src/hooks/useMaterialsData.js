import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useProjects } from '../contexts/ProjectsContext.jsx';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
// Phase 4+: Use API endpoint instead of static JSON file
const DATA_ENDPOINT = `${API_BASE_URL}/api/materials`;
export const MATERIALS_RELOAD_EVENT = 'materials-data-reload';

function normalizeMoney(value) {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const cleaned = value.replace(/[€\s]/g, '').replace(',', '.');
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function computeMetrics(sections) {
  let totalBudget = 0;
  let totalOrdered = 0;
  let pendingCray = 0;
  let pendingDelivery = 0;
  const upcomingDeliveries = [];

  sections.forEach((section) => {
    section.items.forEach((item) => {
      const price = normalizeMoney(item?.price?.ttc ?? null);
      if (price) {
        totalBudget += price;
      }

      const crayStatus = item?.approvals?.cray?.status;
      if (crayStatus !== 'approved') {
        pendingCray += 1;
      }

      const ordered = item?.order?.ordered;
      if (ordered && price) {
        totalOrdered += price;
      }

      const deliveryDate = item?.order?.delivery?.date;
      const deliveryStatus = item?.order?.delivery?.status;
      if (ordered && deliveryStatus !== 'livré') {
        pendingDelivery += 1;
      }
      if (deliveryDate) {
        upcomingDeliveries.push({
          product: item.product,
          section: section.label,
          date: deliveryDate,
          status: deliveryStatus || 'à venir'
        });
      }
    });
  });

  return {
    totalBudget,
    totalOrdered,
    pendingCray,
    pendingDelivery,
    upcomingDeliveries: upcomingDeliveries
      .sort((a, b) => {
        const [dayA, monthA] = a.date.split('/').map(Number);
        const [dayB, monthB] = b.date.split('/').map(Number);
        return monthA === monthB ? dayA - dayB : monthA - monthB;
      })
      .slice(0, 5)
  };
}

export function useMaterialsData() {
  const { selectedProject } = useProjects();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const instanceIdRef = useRef(null);

  if (!instanceIdRef.current) {
    instanceIdRef.current = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  const reload = useCallback(({ broadcast = true } = {}) => {
    setReloadKey((key) => key + 1);
    if (broadcast) {
      window.dispatchEvent(new CustomEvent(MATERIALS_RELOAD_EVENT, {
        detail: { sourceId: instanceIdRef.current }
      }));
    }
  }, []);

  useEffect(() => {
    const handleReloadEvent = (event) => {
      if (event.detail?.sourceId === instanceIdRef.current) {
        return;
      }
      reload({ broadcast: false });
    };

    window.addEventListener(MATERIALS_RELOAD_EVENT, handleReloadEvent);
    return () => {
      window.removeEventListener(MATERIALS_RELOAD_EVENT, handleReloadEvent);
    };
  }, [reload]);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError('');

      if (selectedProject?.id === 'empty-demo-project') {
        if (isMounted) {
          setData({ sections: [] });
          setLoading(false);
        }
        return;
      }

      let dataEndpoint = DATA_ENDPOINT;
      if (selectedProject?.id === 'pending-approval-demo-project') {
        // For demo projects, still use static file if available, otherwise use API
        dataEndpoint = '/materials-pending-approval.json';
      }

      try {
        const response = await fetch(`${dataEndpoint}?ts=${Date.now()}`, {
          cache: 'no-store'
        });
        if (!response.ok) {
          throw new Error(`Failed to load materials data (${response.status})`);
        }
        const json = await response.json();
        if (isMounted) {
          setData(json);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Unable to load materials data');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [selectedProject, reloadKey]);

  const metrics = useMemo(() => {
    if (!data) {
      return null;
    }
    return computeMetrics(data.sections || []);
  }, [data]);

  const updateMaterials = async (newData) => {
    setError('');
    
    // Don't allow updating demo projects
    if (selectedProject?.id === 'empty-demo-project' || selectedProject?.id === 'pending-approval-demo-project') {
      setError('Cannot update demo project');
      return { success: false, error: 'Cannot update demo project' };
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/materials`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ materials: newData })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `Failed to update materials (${response.status})`);
      }

      // Reload data from the server
      const response_data = await fetch(`${DATA_ENDPOINT}?ts=${Date.now()}`, {
        cache: 'no-store'
      });
      if (!response_data.ok) {
        throw new Error(`Failed to reload materials (${response_data.status})`);
      }
      const json = await response_data.json();
      setData(json);
      window.dispatchEvent(new CustomEvent(MATERIALS_RELOAD_EVENT, {
        detail: { sourceId: instanceIdRef.current }
      }));
      
      return { success: true };
    } catch (err) {
      const errorMessage = err.message || 'Unable to update materials data';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  return { data, loading, error, metrics, updateMaterials, reload };
}

export function formatCurrency(amount, locale = 'fr-FR') {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return '—';
  }
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0
  }).format(amount);
}



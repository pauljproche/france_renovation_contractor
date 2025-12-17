import { useMaterialsData, formatCurrency } from '../hooks/useMaterialsData.js';
import { useTranslation } from '../hooks/useTranslation.js';
import { useRole } from '../contexts/AppContext.jsx';
import { useProjects } from '../contexts/ProjectsContext.jsx';
import WorkersCard from '../components/WorkersCard.jsx';

function Dashboard() {
  const { data, loading, error, metrics } = useMaterialsData();
  const { t } = useTranslation();
  const { role } = useRole();
  const { selectedProject } = useProjects();

  // Role-specific context - in future phases, filter metrics/items based on role
  // For now, all roles see the same data, but UI can be customized

  return (
    <>
      <header className="content-header">
        <div>
          <h2>
            {selectedProject ? (
              <>
                {selectedProject.address || selectedProject.name || t('dashboardTitle')}
                {selectedProject.clientName && (
                  <span style={{ 
                    fontSize: '0.85rem', 
                    fontWeight: 400, 
                    color: '#6b7280',
                    marginLeft: '12px'
                  }}>
                    · {selectedProject.clientName}
                  </span>
                )}
              </>
            ) : (
              t('dashboardTitle')
            )}
          </h2>
          <p>{t('dashboardSubtitle')}</p>
        </div>
      </header>

      {loading && <span className="loader">{t('loadingData')}</span>}
      {error && <p className="warning">{error}</p>}

      {metrics && (
        <section className="kpi-grid">
          <div className="kpi-card">
            <h3>{t('totalBudget')}</h3>
            <strong>{formatCurrency(metrics.totalBudget)}</strong>
            <span>{t('totalBudgetSubtitle')}</span>
          </div>
          <div className="kpi-card">
            <h3>{t('ordered')}</h3>
            <strong>{formatCurrency(metrics.totalOrdered)}</strong>
            <span>{t('orderedSubtitle')}</span>
          </div>
          <div className="kpi-card">
            <h3>{t('pendingCray')}</h3>
            <strong>{metrics.pendingCray}</strong>
            <span>{t('pendingCraySubtitle')}</span>
          </div>
          <div className="kpi-card">
            <h3>{t('pendingDeliveries')}</h3>
            <strong>{metrics.pendingDelivery}</strong>
            <span>{t('pendingDeliveriesSubtitle')}</span>
          </div>
        </section>
      )}

      <section className="dashboard-panels">
        <div className="panel">
          <h2>{t('upcomingDeliveries')}</h2>
          {metrics ? (
            metrics.upcomingDeliveries.length > 0 ? (
              <ul>
                {metrics.upcomingDeliveries.map((delivery) => (
                  <li key={`${delivery.section}-${delivery.product}`}>
                    <strong>{delivery.date}</strong> · {delivery.product} ({delivery.section})
                    {delivery.status && delivery.status !== 'à venir' && delivery.status !== t('comingSoon') && (
                      <span className="tag pending" style={{ marginLeft: '8px' }}>
                        {delivery.status}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p>{t('allDeliveriesReceived')}</p>
            )
          ) : (
            <p>{t('noDeliveryData')}</p>
          )}
        </div>
        
        <WorkersCard />
      </section>
    </>
  );
}

export default Dashboard;


import { useState, useEffect } from 'react';
import { useTranslation } from '../hooks/useTranslation.js';
import { useAIPanel } from '../contexts/AppContext.jsx';
import EditableMaterialsTable from '../components/EditableMaterialsTable.jsx';
import { MATERIALS_RELOAD_EVENT } from '../hooks/useMaterialsData.js';

function Materials() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const { setIsAIPanelOpen } = useAIPanel();
  const handleReload = () => {
    window.dispatchEvent(new CustomEvent(MATERIALS_RELOAD_EVENT));
  };

  // Open AI panel when navigating from project page
  useEffect(() => {
    const openAIPanel = sessionStorage.getItem('openAIPanel');
    if (openAIPanel === 'true') {
      setIsAIPanelOpen(true);
      sessionStorage.removeItem('openAIPanel');
    }
  }, [setIsAIPanelOpen]);

  return (
    <>
      <header className="content-header">
        <div>
          <h2>{t('materialsTitle')}</h2>
          <p>{t('materialsSubtitle')}</p>
        </div>
      </header>

      <div className="table-toolbar">
        <input
          type="search"
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button
          type="button"
          className="table-toolbar-reload"
          onClick={handleReload}
        >
          {t('reloadData') || 'Reload data'}
        </button>
      </div>

      <EditableMaterialsTable search={search} />
    </>
  );
}

export default Materials;


import React, { useState } from 'react';
import { StoreProvider } from './context/StoreContext';
import { AppShell } from './components/layout/AppShell';
import { POSScreen } from './components/pos/POSScreen';
import { InventoryScreen } from './components/inventory/InventoryScreen';
import { ProductsScreen } from './components/products/ProductsScreen';
import { SalesHistoryScreen } from './components/sales/SalesHistoryScreen';
import { DashboardScreen } from './components/dashboard/DashboardScreen';
import { StaffScreen } from './components/staff/StaffScreen';
import { AuditLogsScreen } from './components/audit/AuditLogsScreen';
import { SettingsScreen } from './components/settings/SettingsScreen';

function MainApp() {
  const [currentTab, setCurrentTab] = useState<string>('pos');

  return (
    <AppShell currentTab={currentTab} onSelectTab={setCurrentTab}>
      {currentTab === 'pos' && <POSScreen />}
      {currentTab === 'inventory' && <InventoryScreen />}
      {currentTab === 'products' && <ProductsScreen />}
      {currentTab === 'sales' && <SalesHistoryScreen />}
      {currentTab === 'dashboard' && (
        <DashboardScreen
          onNavigateToPOS={() => setCurrentTab('pos')}
          onNavigateToInventory={() => setCurrentTab('inventory')}
        />
      )}
      {currentTab === 'staff' && <StaffScreen />}
      {currentTab === 'audit' && <AuditLogsScreen />}
      {currentTab === 'settings' && <SettingsScreen />}
    </AppShell>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <MainApp />
    </StoreProvider>
  );
}

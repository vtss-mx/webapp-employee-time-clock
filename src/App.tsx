import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AnalyticsConsent } from './components/AnalyticsConsent';
import { GlobalErrorHandler } from './components/GlobalErrorHandler';
import { AnalyticsTracker } from './components/AnalyticsTracker';
import { WebPerformanceTracker } from './components/WebPerformanceTracker';
import { AuthProvider } from './context/AuthContext';
import { CatalogProvider } from './context/CatalogContext';
import { DeviceGate } from './routes/DeviceGate';
import { MfaGate } from './routes/MfaGate';
import { SuspensionGate } from './routes/SuspensionGate';
import { VersionWatcher } from './components/VersionWatcher';
import { FeedbackProvider } from './context/FeedbackContext';
import { LocaleSync } from './i18n/LocaleSync';
import { AppRouter } from './routes/AppRouter';

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <FeedbackProvider>
          <GlobalErrorHandler />
          <AnalyticsConsent />
          <WebPerformanceTracker />
          <VersionWatcher />
          <AuthProvider>
            <AnalyticsTracker />
            <LocaleSync />
            <CatalogProvider>
              <DeviceGate>
                <SuspensionGate>
                  <MfaGate>
                    <AppRouter />
                  </MfaGate>
                </SuspensionGate>
              </DeviceGate>
            </CatalogProvider>
          </AuthProvider>
        </FeedbackProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GlobalErrorHandler } from './components/GlobalErrorHandler';
import { AuthProvider } from './context/AuthContext';
import { CatalogProvider } from './context/CatalogContext';
import { DeviceGate } from './routes/DeviceGate';
import { VersionWatcher } from './components/VersionWatcher';
import { FeedbackProvider } from './context/FeedbackContext';
import { AppRouter } from './routes/AppRouter';

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <FeedbackProvider>
          <GlobalErrorHandler />
          <VersionWatcher />
          <AuthProvider>
            <CatalogProvider>
              <DeviceGate>
                <AppRouter />
              </DeviceGate>
            </CatalogProvider>
          </AuthProvider>
        </FeedbackProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

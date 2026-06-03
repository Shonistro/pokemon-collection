import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Collection } from './pages/Collection';
import { AddCard } from './pages/AddCard';
import { CardDetail } from './pages/CardDetail';

/**
 * Route table. Everything except /login is wrapped in <ProtectedRoute>, and
 * the authenticated routes share the <Layout> (header + bottom nav).
 */
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Collection />} />
        <Route path="/add" element={<AddCard />} />
        <Route path="/card/:collectionId" element={<CardDetail />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

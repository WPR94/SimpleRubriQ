import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };  return (
    <nav className="bg-white shadow mb-6">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">        <div className="flex items-center space-x-6">
          <Link to="/dashboard" className="font-bold text-lg text-blue-700 hover:text-blue-900">MarkMate</Link>
          <Link to="/dashboard" className="text-gray-700 hover:text-blue-600">Dashboard</Link>
          <Link to="/rubrics" className="text-gray-700 hover:text-blue-600">Rubrics</Link>
          <Link to="/students" className="text-gray-700 hover:text-blue-600">Students</Link>
          <Link to="/essay-feedback" className="text-gray-700 hover:text-blue-600">Essay Feedback</Link>
          <Link to="/analytics" className="text-gray-700 hover:text-blue-600">Analytics</Link>
          <Link to="/batch" className="text-gray-700 hover:text-blue-600">Batch</Link>
        </div>
        <div className="flex items-center space-x-4">
          {user && <span className="text-sm text-gray-500">{user.email}</span>}
          <button onClick={handleLogout} className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600">Logout</button>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;

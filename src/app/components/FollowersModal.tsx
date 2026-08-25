import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { DataService } from '../../lib/dataService';
import { Avatar } from '../../components/common/Avatar';
import { DEFAULT_AVATAR_URL } from '../../lib/defaults';

interface FollowersModalProps {
  userId: string;
  type: 'followers' | 'following';
  onClose: () => void;
}

export function FollowersModal({ userId, type, onClose }: FollowersModalProps) {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    (async () => {
      try {
        const resp = type === 'followers' ? await DataService.getFollowers(userId) : await DataService.getFollowing(userId);
        if (!mounted) return;
        if (!resp.error) {
          setItems(resp.data || []);
        } else {
          setItems([]);
        }
      } catch (err) {
        setItems([]);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [userId, type]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-50 w-full max-w-md bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold">{type === 'followers' ? 'Followers' : 'Following'}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="max-h-96 overflow-y-auto p-4">
          {isLoading ? (
            <div className="text-sm text-gray-600">Loading...</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-gray-600">No users found.</div>
          ) : (
            items.map((u) => (
              <button
                key={u.id || u.user_id || u.id}
                onClick={() => {
                  // Debug: log the clicked user object to help diagnose incorrect navigation
                  // eslint-disable-next-line no-console
                  console.log('FollowersModal clicked user:', u);
                  const targetId = u.id || u.user_id || (u.users && u.users.id) || null;
                  if (!targetId) return;
                  onClose();
                  navigate(`/profile/${targetId}`);
                }}
                className="w-full text-left flex items-center gap-3 py-2 border-b last:border-b-0 hover:bg-gray-50"
              >
                <Avatar src={u.avatar_url || DEFAULT_AVATAR_URL} alt={u.full_name} gender={u.gender} sizeClassName="w-10 h-10" />
                <div>
                  <div className="font-semibold text-sm">{u.full_name || 'Unknown'}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default FollowersModal;

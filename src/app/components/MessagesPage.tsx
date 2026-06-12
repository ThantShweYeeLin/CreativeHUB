import { ChevronLeft, Search, Send, Plus, Users, MoreVertical, Image as ImageIcon, Smile, Paperclip, X } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { useState } from 'react';

interface MessagesPageProps {
  onBack: () => void;
}

interface Conversation {
  id: number;
  type: 'individual' | 'group';
  name: string;
  avatar: string;
  members?: { name: string; avatar: string }[];
  lastMessage: string;
  time: string;
  unread: number;
  online?: boolean;
}

interface Message {
  id: number;
  sender: 'me' | 'other';
  senderName?: string;
  senderAvatar?: string;
  content: string;
  time: string;
  type: 'text' | 'image';
}

const conversations: Conversation[] = [
  {
    id: 1,
    type: 'individual',
    name: 'Simran Sood',
    avatar: 'https://images.unsplash.com/photo-1637862666931-be59da5dd8ca?w=200',
    lastMessage: 'I\'d love to work on this project! Let\'s discuss the details.',
    time: '5m ago',
    unread: 2,
    online: true
  },
  {
    id: 2,
    type: 'individual',
    name: 'Marcus Chen',
    avatar: 'https://images.unsplash.com/photo-1706661912765-7d0f68289a0f?w=200',
    lastMessage: 'Excited to capture this event! Available on the requested dates.',
    time: '2h ago',
    unread: 0,
    online: true
  },
  {
    id: 3,
    type: 'group',
    name: 'Fashion Shoot Team',
    avatar: 'https://images.unsplash.com/photo-1594171549465-a28ba0220a1b?w=200',
    members: [
      { name: 'Darling Arias', avatar: 'https://images.unsplash.com/photo-1594171549465-a28ba0220a1b?w=200' },
      { name: 'Laura Chouette', avatar: 'https://images.unsplash.com/photo-1596704182101-542876d47a68?w=200' },
      { name: 'Daria Magazzu', avatar: 'https://images.unsplash.com/photo-1559878541-926091e4c31b?w=200' }
    ],
    lastMessage: 'Darling: Sounds great! See you tomorrow at 10am',
    time: '1d ago',
    unread: 0
  },
  {
    id: 4,
    type: 'individual',
    name: 'Darling Arias',
    avatar: 'https://images.unsplash.com/photo-1594171549465-a28ba0220a1b?w=200',
    lastMessage: 'Thank you for booking! Looking forward to working with you.',
    time: '2d ago',
    unread: 0,
    online: false
  }
];

const mockMessages: Message[] = [
  {
    id: 1,
    sender: 'other',
    senderName: 'Simran Sood',
    senderAvatar: 'https://images.unsplash.com/photo-1637862666931-be59da5dd8ca?w=200',
    content: 'Hi! Thank you for your booking request!',
    time: '10:30 AM',
    type: 'text'
  },
  {
    id: 2,
    sender: 'me',
    content: 'Hello! I\'m excited to work with you on this project.',
    time: '10:32 AM',
    type: 'text'
  },
  {
    id: 3,
    sender: 'other',
    senderName: 'Simran Sood',
    senderAvatar: 'https://images.unsplash.com/photo-1637862666931-be59da5dd8ca?w=200',
    content: 'I\'d love to work on this project! Let\'s discuss the details.',
    time: '10:35 AM',
    type: 'text'
  },
  {
    id: 4,
    sender: 'me',
    content: 'Perfect! When would be a good time for you?',
    time: '10:37 AM',
    type: 'text'
  },
  {
    id: 5,
    sender: 'other',
    senderName: 'Simran Sood',
    senderAvatar: 'https://images.unsplash.com/photo-1637862666931-be59da5dd8ca?w=200',
    content: 'I\'m available this Friday afternoon. Does 2 PM work for you?',
    time: '10:40 AM',
    type: 'text'
  }
];

export function MessagesPage({ onBack }: MessagesPageProps) {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(conversations[0]);
  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const [messageInput, setMessageInput] = useState('');
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [selectedFreelancers, setSelectedFreelancers] = useState<number[]>([]);
  const [groupName, setGroupName] = useState('');
  const [showChatOnMobile, setShowChatOnMobile] = useState(false);

  const availableFreelancers = [
    { id: 1, name: 'Darling Arias', specialty: 'Photographer', avatar: 'https://images.unsplash.com/photo-1594171549465-a28ba0220a1b?w=200' },
    { id: 2, name: 'Laura Chouette', specialty: 'Makeup Artist', avatar: 'https://images.unsplash.com/photo-1596704182101-542876d47a68?w=200' },
    { id: 3, name: 'Daria Magazzu', specialty: 'Model', avatar: 'https://images.unsplash.com/photo-1559878541-926091e4c31b?w=200' },
    { id: 4, name: 'Marcus Chen', specialty: 'Photographer', avatar: 'https://images.unsplash.com/photo-1706661912765-7d0f68289a0f?w=200' }
  ];

  const handleSendMessage = () => {
    if (messageInput.trim()) {
      const newMessage: Message = {
        id: messages.length + 1,
        sender: 'me',
        content: messageInput,
        time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        type: 'text'
      };
      setMessages([...messages, newMessage]);
      setMessageInput('');
    }
  };

  const handleCreateGroup = () => {
    if (groupName.trim() && selectedFreelancers.length > 0) {
      // TODO: Create group logic
      console.log('Creating group:', groupName, selectedFreelancers);
      setShowGroupModal(false);
      setGroupName('');
      setSelectedFreelancers([]);
    }
  };

  const toggleFreelancerSelection = (id: number) => {
    setSelectedFreelancers(prev =>
      prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 pb-20 md:pb-0">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-gray-200">
        <div className="max-w-[1680px] mx-auto px-4 md:px-8 py-4 md:py-6">
          <button
            onClick={showChatOnMobile ? () => setShowChatOnMobile(false) : onBack}
            className="flex items-center gap-2 text-gray-900 hover:text-black font-semibold mb-3 md:mb-4 transition-colors text-sm md:text-base"
          >
            <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
            {showChatOnMobile ? 'Back to Messages' : 'Back to Home'}
          </button>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Messages</h1>
            <button
              onClick={() => setShowGroupModal(true)}
              className="flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 bg-gradient-to-r from-gray-900 to-black text-white rounded-lg md:rounded-xl text-sm md:text-base font-semibold hover:shadow-lg hover:scale-105 transition-all"
            >
              <Plus className="w-4 h-4 md:w-5 md:h-5" />
              <span className="hidden md:inline">Create Group</span>
              <span className="md:hidden">Group</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1680px] mx-auto px-4 md:px-8 py-4 md:py-8">
        <div className="flex gap-6 h-[calc(100vh-180px)] md:h-[calc(100vh-240px)]">
          {/* Conversations Sidebar */}
          <div className={`${showChatOnMobile ? 'hidden md:block' : 'block'} w-full md:w-96 bg-white rounded-xl md:rounded-2xl shadow-lg border border-gray-200 overflow-hidden flex flex-col`}>
            {/* Search */}
            <div className="p-4 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search conversations..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 rounded-lg border border-gray-200 focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none transition-all"
                />
              </div>
            </div>

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto">
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => {
                    setSelectedConversation(conversation);
                    setShowChatOnMobile(true);
                  }}
                  className={`w-full p-3 md:p-4 flex items-start gap-3 hover:bg-gray-50 transition-colors border-b border-gray-100 ${
                    selectedConversation?.id === conversation.id ? 'bg-gray-50' : ''
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    {conversation.type === 'group' ? (
                      <div className="w-14 h-14 bg-gradient-to-br from-gray-800 to-gray-900 rounded-full flex items-center justify-center">
                        <Users className="w-7 h-7 text-white" />
                      </div>
                    ) : (
                      <>
                        <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-white">
                          <ImageWithFallback
                            src={conversation.avatar}
                            alt={conversation.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        {conversation.online && (
                          <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
                        )}
                      </>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-bold text-gray-900 truncate">{conversation.name}</h3>
                      <span className="text-xs text-gray-500 flex-shrink-0">{conversation.time}</span>
                    </div>
                    <p className="text-sm text-gray-600 truncate">{conversation.lastMessage}</p>
                  </div>

                  {/* Unread Badge */}
                  {conversation.unread > 0 && (
                    <div className="w-6 h-6 bg-gradient-to-r from-gray-900 to-black rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-white">{conversation.unread}</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Area */}
          {selectedConversation ? (
            <div className={`${showChatOnMobile ? 'block' : 'hidden md:block'} flex-1 bg-white rounded-xl md:rounded-2xl shadow-lg border border-gray-200 overflow-hidden flex flex-col`}>
              {/* Chat Header */}
              <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-gray-50 to-gray-100">
                <div className="flex items-center gap-3">
                  {selectedConversation.type === 'group' ? (
                    <div className="w-12 h-12 bg-gradient-to-br from-gray-800 to-gray-900 rounded-full flex items-center justify-center">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-white">
                        <ImageWithFallback
                          src={selectedConversation.avatar}
                          alt={selectedConversation.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      {selectedConversation.online && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                      )}
                    </div>
                  )}
                  <div>
                    <h2 className="font-bold text-gray-900">{selectedConversation.name}</h2>
                    {selectedConversation.type === 'group' && selectedConversation.members && (
                      <p className="text-sm text-gray-600">{selectedConversation.members.length} members</p>
                    )}
                    {selectedConversation.type === 'individual' && (
                      <p className="text-sm text-gray-600">{selectedConversation.online ? 'Online' : 'Offline'}</p>
                    )}
                  </div>
                </div>
                <button className="p-2 hover:bg-white rounded-full transition-colors">
                  <MoreVertical className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${message.sender === 'me' ? 'flex-row-reverse' : ''}`}
                  >
                    {message.sender === 'other' && (
                      <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-white flex-shrink-0">
                        <ImageWithFallback
                          src={message.senderAvatar || ''}
                          alt={message.senderName || ''}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className={`flex flex-col ${message.sender === 'me' ? 'items-end' : ''}`}>
                      {message.sender === 'other' && selectedConversation.type === 'group' && (
                        <span className="text-xs font-semibold text-gray-600 mb-1 px-1">{message.senderName}</span>
                      )}
                      <div
                        className={`px-4 py-3 rounded-2xl max-w-md ${
                          message.sender === 'me'
                            ? 'bg-gradient-to-r from-gray-900 to-black text-white rounded-tr-none'
                            : 'bg-white text-gray-900 rounded-tl-none shadow-md border border-gray-200'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                      </div>
                      <span className="text-xs text-gray-500 mt-1 px-1">{message.time}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-gray-200 bg-white">
                <div className="flex items-center gap-3">
                  <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <Paperclip className="w-5 h-5 text-gray-600" />
                  </button>
                  <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <ImageIcon className="w-5 h-5 text-gray-600" />
                  </button>
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none transition-all"
                  />
                  <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <Smile className="w-5 h-5 text-gray-600" />
                  </button>
                  <button
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim()}
                    className="p-3 bg-gradient-to-r from-gray-900 to-black text-white rounded-full hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 bg-white rounded-2xl shadow-lg border border-gray-200 flex items-center justify-center">
              <div className="text-center">
                <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Users className="w-12 h-12 text-gray-900" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Select a Conversation</h3>
                <p className="text-gray-600">Choose a conversation from the sidebar to start messaging</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Group Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 rounded-t-3xl flex items-center justify-between z-10">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Create Group Chat</h2>
                <p className="text-sm text-gray-600">Select freelancers to add to the group</p>
              </div>
              <button
                onClick={() => {
                  setShowGroupModal(false);
                  setGroupName('');
                  setSelectedFreelancers([]);
                }}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            <div className="p-8 space-y-6">
              {/* Group Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Group Name</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Enter group name..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400 outline-none transition-all"
                />
              </div>

              {/* Selected Count */}
              {selectedFreelancers.length > 0 && (
                <div className="px-4 py-3 bg-gray-50 rounded-lg border-2 border-gray-200">
                  <p className="text-sm font-semibold text-gray-900">
                    {selectedFreelancers.length} freelancer{selectedFreelancers.length > 1 ? 's' : ''} selected
                  </p>
                </div>
              )}

              {/* Freelancer Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Select Members</label>
                <div className="space-y-2">
                  {availableFreelancers.map((freelancer) => (
                    <button
                      key={freelancer.id}
                      onClick={() => toggleFreelancerSelection(freelancer.id)}
                      className={`w-full p-4 flex items-center gap-4 rounded-xl border-2 transition-all ${
                        selectedFreelancers.includes(freelancer.id)
                          ? 'border-gray-500 bg-gray-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-white">
                        <ImageWithFallback
                          src={freelancer.avatar}
                          alt={freelancer.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 text-left">
                        <h4 className="font-bold text-gray-900">{freelancer.name}</h4>
                        <p className="text-sm text-gray-600">{freelancer.specialty}</p>
                      </div>
                      <div
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                          selectedFreelancers.includes(freelancer.id)
                            ? 'border-gray-900 bg-gray-900'
                            : 'border-gray-300'
                        }`}
                      >
                        {selectedFreelancers.includes(freelancer.id) && (
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-8 py-6 rounded-b-3xl flex items-center justify-between">
              <button
                onClick={() => {
                  setShowGroupModal(false);
                  setGroupName('');
                  setSelectedFreelancers([]);
                }}
                className="px-6 py-3 text-gray-700 font-semibold hover:bg-gray-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={!groupName.trim() || selectedFreelancers.length === 0}
                className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-gray-900 to-black text-white rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <Users className="w-5 h-5" />
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

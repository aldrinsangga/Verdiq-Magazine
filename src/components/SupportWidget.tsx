import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, X, ChevronLeft, Shield, CircleAlert as AlertCircle, CircleCheck as CheckCircle2, Clock, Trash2, Reply } from 'lucide-react';
import { SupportTicket, SupportMessage } from '../../types';
import { api } from '../services/api';

interface SupportWidgetProps {
  currentUser: any;
}

const SupportWidget: React.FC<SupportWidgetProps> = ({ currentUser }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<'list' | 'form' | 'chat'>('list');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<SupportTicket['category']>('Technical Support');
  const [message, setMessage] = useState('');
  const [replyText, setReplyText] = useState('');
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentUser) {
      fetchMyTickets();
    }
  }, [currentUser]);

  useEffect(() => {
    if (view === 'chat' && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [view, selectedTicket?.messages]);

  const fetchMyTickets = async () => {
    try {
      const data = await api.getMyTickets();
      setTickets(data);
    } catch (err) {
      console.error('Failed to fetch tickets:', err);
    }
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const newTicket = await api.createSupportTicket({
        name: currentUser.name,
        email: currentUser.email,
        subject,
        category,
        message
      });
      setTickets([newTicket, ...tickets]);
      setSubject('');
      setMessage('');
      setView('list');
    } catch (err: any) {
      setError(err.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicket) return;

    setLoading(true);
    try {
      const data = await api.addTicketMessage(selectedTicket.id, replyText);
      const updatedTicket = {
        ...selectedTicket,
        messages: [...(selectedTicket.messages || []), data.message]
      };
      setSelectedTicket(updatedTicket);
      setTickets(tickets.map(t => t.id === selectedTicket.id ? updatedTicket : t));
      setReplyText('');
    } catch (err) {
      console.error('Failed to send reply:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (ticketId: string) => {
    try {
      await api.markTicketRead(ticketId);
      setTickets(tickets.map(t => t.id === ticketId ? { ...t, hasUnreadReply: false } : t));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const hasUnread = tickets.some(t => t.hasUnreadReply);

  if (!currentUser) return null;

  return (
    <div className="fixed bottom-4 right-4 md:bottom-8 md:right-8 z-[100]">
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 relative group ${
          isOpen ? 'bg-slate-800 rotate-90' : 'bg-emerald-500 hover:scale-110'
        }`}
      >
        {isOpen ? (
          <X className="w-8 h-8 text-white" />
        ) : (
          <MessageCircle className="w-8 h-8 text-slate-950" />
        )}
        
        {!isOpen && hasUnread && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 rounded-full border-2 border-slate-950 animate-pulse" />
        )}
        
        {/* Tooltip */}
        {!isOpen && (
          <div className="absolute right-20 bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-white/5">
            Support Studio
          </div>
        )}
      </button>

      {/* Support Panel */}
      {isOpen && (
        <div className="absolute bottom-20 right-0 w-[calc(100vw-32px)] sm:w-[380px] h-[520px] max-h-[calc(100vh-120px)] bg-slate-900 rounded-[32px] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="p-4 md:p-6 bg-slate-800/50 border-b border-white/5 flex items-center gap-4">
            {view !== 'list' && (
              <button 
                onClick={() => {
                  if (view === 'chat' && selectedTicket?.hasUnreadReply) {
                    markAsRead(selectedTicket.id);
                  }
                  setView('list');
                  setSelectedTicket(null);
                }} 
                className="text-slate-400 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
            <div className="flex-grow">
              <h3 className="text-lg font-black text-white tracking-tight">
                {view === 'list' && 'Support Studio'}
                {view === 'form' && 'New Ticket'}
                {view === 'chat' && selectedTicket?.subject}
              </h3>
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
                {view === 'list' && 'How can we help?'}
                {view === 'form' && 'Send us a message'}
                {view === 'chat' && `Status: ${selectedTicket?.status}`}
              </p>
            </div>
            {view === 'list' && (
              <button 
                onClick={() => setView('form')}
                className="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center hover:bg-emerald-500 hover:text-slate-950 transition-all"
              >
                <Send className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Content */}
          <div className="flex-grow overflow-y-auto p-4 md:p-6">
            {view === 'list' && (
              <div className="space-y-4">
                {tickets.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 opacity-50">
                      <Shield className="w-8 h-8 text-slate-500" />
                    </div>
                    <p className="text-slate-500 text-xs font-bold">No support tickets yet.</p>
                    <button 
                      onClick={() => setView('form')}
                      className="mt-4 text-emerald-500 text-[10px] font-black uppercase tracking-widest hover:underline"
                    >
                      Create your first ticket
                    </button>
                  </div>
                ) : (
                  tickets.map(ticket => (
                    <button
                      key={ticket.id}
                      onClick={() => {
                        setSelectedTicket(ticket);
                        setView('chat');
                        if (ticket.hasUnreadReply) {
                          markAsRead(ticket.id);
                        }
                      }}
                      className="w-full text-left p-4 rounded-2xl bg-slate-800/30 border border-white/5 hover:border-emerald-500/30 transition-all group relative"
                    >
                      {ticket.hasUnreadReply && (
                        <div className="absolute top-4 right-4 w-2 h-2 bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
                      )}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                            ticket.status === 'open' ? 'bg-emerald-500/10 text-emerald-500' :
                            ticket.status === 'resolved' ? 'bg-blue-500/10 text-blue-500' :
                            ticket.status === 'follow-up' ? 'bg-amber-500/10 text-amber-500' :
                            'bg-slate-700 text-slate-400'
                          }`}>
                            {ticket.status}
                          </span>
                          <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">
                            {ticket.category}
                          </span>
                        </div>
                        <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">
                          {new Date(ticket.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white mb-1 group-hover:text-emerald-400 transition-colors line-clamp-1">
                        {ticket.subject}
                      </h4>
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {ticket.message}
                      </p>
                    </button>
                  ))
                )}
              </div>
            )}

            {view === 'form' && (
              <form onSubmit={handleSubmitTicket} className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase font-black text-emerald-500 mb-1.5 ml-1">Subject</label>
                  <input
                    required
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    placeholder="Briefly describe your issue"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-black text-emerald-500 mb-1.5 ml-1">Category</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as SupportTicket['category'])}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 appearance-none cursor-pointer"
                  >
                    <option value="Technical Support">Technical Support</option>
                    <option value="Billing & Credits">Billing & Credits</option>
                    <option value="Feedback & Suggestion">Feedback & Suggestion</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-black text-emerald-500 mb-1.5 ml-1">Message</label>
                  <textarea
                    required
                    rows={4}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
                    placeholder="How can we help you today?"
                  />
                </div>
                {error && (
                  <div className="flex items-center gap-2 text-rose-500 text-xs font-bold px-1">
                    <AlertCircle className="w-4 h-4" />
                    <span>{error}</span>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading || !subject.trim() || !message.trim()}
                  className="w-full bg-emerald-500 text-slate-950 font-black py-4 rounded-2xl hover:bg-emerald-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? 'Sending...' : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Message
                    </>
                  )}
                </button>
              </form>
            )}

            {view === 'chat' && selectedTicket && (
              <div className="flex flex-col h-full">
                <div className="space-y-6 pb-4">
                  {/* Initial Message */}
                  <div className="flex flex-col items-start">
                    <div className="max-w-[85%] bg-slate-800 rounded-2xl rounded-tl-none p-4 border border-white/5">
                      <p className="text-xs text-white leading-relaxed">{selectedTicket.message}</p>
                      <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mt-2">
                        {new Date(selectedTicket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  {/* Replies */}
                  {selectedTicket.messages?.map((msg, i) => (
                    <div key={i} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[85%] p-4 rounded-2xl border ${
                        msg.sender === 'user' 
                          ? 'bg-emerald-500 text-slate-950 rounded-tr-none border-emerald-400/30' 
                          : 'bg-slate-800 text-white rounded-tl-none border-white/5'
                      }`}>
                        <p className="text-xs leading-relaxed">{msg.text}</p>
                        <p className={`text-[8px] font-bold uppercase tracking-widest mt-2 ${
                          msg.sender === 'user' ? 'text-slate-900/60' : 'text-slate-500'
                        }`}>
                          {msg.sender === 'admin' ? 'Verdiq Support' : 'You'} • {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              </div>
            )}
          </div>

          {/* Chat Input */}
          {view === 'chat' && selectedTicket && selectedTicket.status !== 'closed' && selectedTicket.status !== 'deleted' && (
            <div className="p-4 bg-slate-800/50 border-t border-white/5">
              <form onSubmit={handleSendReply} className="flex gap-2">
                <input
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  className="flex-grow bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                  placeholder="Type a reply..."
                />
                <button
                  type="submit"
                  disabled={loading || !replyText.trim()}
                  className="w-10 h-10 bg-emerald-500 text-slate-950 rounded-xl flex items-center justify-center hover:bg-emerald-400 transition-all disabled:opacity-50"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          )}
          
          {view === 'chat' && selectedTicket && (selectedTicket.status === 'closed' || selectedTicket.status === 'deleted') && (
            <div className="p-4 bg-slate-800/50 border-t border-white/5 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                This ticket is {selectedTicket.status}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SupportWidget;

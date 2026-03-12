import React, { useState } from 'react';
import { api } from '../services/api';

const ContactUs = () => {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setErrorMessage('');
    
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    
    const data = {
      name: formData.get('name'),
      email: formData.get('email'),
      subject: formData.get('subject'),
      message: formData.get('message')
    };
    
    try {
      await api.createSupportTicket({
        name: data.name as string,
        email: data.email as string,
        subject: data.subject as string,
        category: 'Others',
        message: data.message as string
      });

      setStatus('sent');
      form.reset();
      
      setTimeout(() => {
        setStatus('idle');
      }, 5000);
    } catch (error) {
      console.error('Error sending message:', error);
      setStatus('error');
      setErrorMessage('Failed to send message. Please try again later.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-8 py-24">
      <div className="text-center mb-16">
        <h1 className="text-5xl font-black mb-6 tracking-tighter uppercase">Contact <span className="text-emerald-500">Us</span></h1>
        <p className="text-slate-400 text-lg">Have a question, feedback, or need technical support? We're here to help.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Contact Info */}
        <div>
          <div className="bg-slate-900/50 border border-white/5 rounded-3xl p-8 mb-8">
            <h3 className="text-2xl font-bold text-white mb-6">Get in Touch</h3>
            
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="bg-emerald-500/10 p-3 rounded-xl text-emerald-500">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">Email Support</p>
                  <a href="mailto:verdiqmag@gmail.com" className="text-lg font-medium text-white hover:text-emerald-400 transition-colors">
                    verdiqmag@gmail.com
                  </a>
                  <p className="text-sm text-slate-400 mt-1">We typically reply within 24-48 hours.</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="bg-emerald-500/10 p-3 rounded-xl text-emerald-500">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">Business Hours</p>
                  <p className="text-lg font-medium text-white">Monday - Friday</p>
                  <p className="text-sm text-slate-400 mt-1">9:00 AM - 5:00 PM (PST)</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/50 border border-white/5 rounded-3xl p-8">
            <h3 className="text-xl font-bold text-white mb-4">Partnerships & Press</h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-4">
              Interested in partnering with Verdiq or featuring us in the press? Reach out to our media team directly.
            </p>
            <a href="mailto:verdiqmag@gmail.com?subject=Partnership Inquiry" className="text-emerald-500 font-bold hover:text-emerald-400 transition-colors flex items-center gap-2">
              Contact Media Team
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </a>
          </div>
        </div>

        {/* Contact Form */}
        <div className="bg-slate-900 border border-white/10 rounded-3xl p-8 shadow-2xl">
          <h3 className="text-2xl font-bold text-white mb-6">Send a Message</h3>
          
          {status === 'sent' ? (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-8 text-center h-[300px] flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4 text-emerald-500">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h4 className="text-xl font-bold text-white mb-2">Message Sent!</h4>
              <p className="text-slate-400">Thank you for reaching out. We'll get back to you shortly.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm">
                  {errorMessage}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Name</label>
                <input 
                  type="text" 
                  name="name"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  placeholder="Your name"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Email</label>
                <input 
                  type="email" 
                  name="email"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  placeholder="your@email.com"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Subject</label>
                <select name="subject" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all">
                  <option value="support">Technical Support</option>
                  <option value="billing">Billing & Credits</option>
                  <option value="feedback">Feedback & Suggestions</option>
                  <option value="other">Other</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Message</label>
                <textarea 
                  name="message"
                  required
                  rows={4}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all resize-none"
                  placeholder="How can we help you?"
                ></textarea>
              </div>
              
              <button 
                type="submit"
                disabled={status === 'sending'}
                className="w-full bg-emerald-500 text-slate-950 py-4 rounded-xl font-bold hover:bg-emerald-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
              >
                {status === 'sending' ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending...
                  </>
                ) : (
                  'Send Message'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactUs;

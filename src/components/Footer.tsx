import React from 'react';

interface FooterProps {
  navigate: (view: string) => void;
}

const Footer: React.FC<FooterProps> = ({ navigate }) => {
  return (
    <footer className="border-t border-slate-900 bg-slate-950 py-12 px-6 mt-20">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8 mb-8">
          <div className="flex items-center gap-4 text-slate-500">
            <span className="text-xl font-bold text-slate-200">Verdiq</span>
            <span className="text-xs uppercase tracking-widest">© 2024 Future of Sound and Critic</span>
          </div>
          <div className="flex flex-wrap justify-center gap-8">
             <button onClick={() => navigate('guide')} className="text-xs font-bold uppercase text-slate-500 hover:text-emerald-500 transition-colors border-none bg-transparent">Submission Guide</button>
             <button onClick={() => navigate('podcasts')} className="text-xs font-bold uppercase text-slate-500 hover:text-emerald-500 transition-colors border-none bg-transparent">Podcasts</button>
             <button onClick={() => navigate('pricing')} className="text-xs font-bold uppercase text-slate-500 hover:text-emerald-500 transition-colors border-none bg-transparent">Pricing</button>
             <button onClick={() => navigate('faq')} className="text-xs font-bold uppercase text-slate-500 hover:text-emerald-500 transition-colors border-none bg-transparent">FAQ</button>
             <button onClick={() => navigate('contact')} className="text-xs font-bold uppercase text-slate-500 hover:text-emerald-500 transition-colors border-none bg-transparent">Contact Us</button>
          </div>
        </div>
        <div className="flex justify-center gap-8 pt-8 border-t border-slate-900/50">
          <button onClick={() => navigate('privacy')} className="text-[10px] font-bold uppercase text-slate-600 hover:text-slate-400 transition-colors border-none bg-transparent">Privacy Policy</button>
          <button onClick={() => navigate('terms')} className="text-[10px] font-bold uppercase text-slate-600 hover:text-slate-400 transition-colors border-none bg-transparent">Terms & Conditions</button>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

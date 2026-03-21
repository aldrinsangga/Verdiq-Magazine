import React, { useState } from 'react';
import { ChevronDown, ChevronUp, MessageCircle } from 'lucide-react';

interface FAQProps {
  onContactSupport?: () => void;
}

const FAQ: React.FC<FAQProps> = ({ onContactSupport }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: "What is Verdiq?",
      answer: "Verdiq is an AI-powered music analysis and review platform. We use advanced artificial intelligence to analyze the technical aspects of your audio, write professional editorial reviews, and generate realistic, multi-speaker podcast episodes discussing your music."
    },
    {
      question: "How does the credit system work?",
      answer: "Verdiq operates on a pay-as-you-go credit system. Generating a full review (including the podcast) costs 10 credits. Publishing your review to our public Magazine costs 5 credits. Editing an existing review costs 3 credits. You can purchase credits in bulk, and they never expire."
    },
    {
      question: "Who owns the rights to the generated reviews and podcasts?",
      answer: "You do! You retain full ownership of your original music. By generating a review, you are granted a license to use the generated text and podcast audio for your own promotional purposes. If you choose to publish to the Verdiq Magazine, you grant us a non-exclusive license to display the content on our platform."
    },
    {
      question: "Is my unreleased music safe?",
      answer: "Yes. We take privacy seriously. Your uploaded audio files are processed securely and are not shared publicly unless you explicitly choose to publish your review to the Magazine. We do not claim any copyright over your original works."
    },
    {
      question: "Can I edit the AI-generated review?",
      answer: "Yes! If you want to tweak the narrative or correct any details, you can edit the generated review text. Note that editing a review costs 3 credits, as it requires re-processing the data."
    },
    {
      question: "What audio formats do you support?",
      answer: "We currently support MP3, WAV, FLAC, AAC, and OGG files up to 50MB in size. For the best spectral analysis, we recommend high-quality WAV or 320kbps MP3 files."
    },
    {
      question: "Do you offer refunds?",
      answer: "Due to the computational costs associated with AI processing and audio generation, we generally do not offer refunds on used credits or purchased credit packages. If you experience a technical failure where credits were deducted but no review was generated, please contact our support team."
    },
    {
      question: "How long does it take to generate a review?",
      answer: "Typically, the AI analysis and editorial writing take about 30-60 seconds. Generating the full multi-speaker podcast episode can take an additional 1-2 minutes depending on the length of the track and server load."
    },
    {
      question: "Can I use the podcast audio on my social media?",
      answer: "Absolutely! The podcast audio is generated for you to use as promotional content. You can share it on Instagram, TikTok, YouTube, or any other platform to give your fans a unique 'behind-the-scenes' look at your music."
    },
    {
      question: "What is the 'Studio History'?",
      answer: "The Studio History is your personal archive where all your generated reviews, drafts, and deleted items are stored. You can access your previous work, publish drafts to the Magazine, or download your podcast episodes at any time."
    },
    {
      question: "How do I earn referral credits?",
      answer: "You can find your unique referral link in the 'Referral Program' section of your profile menu. When a fellow artist signs up using your link and makes their first credit purchase, you'll automatically receive 5 bonus credits."
    }
  ];

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="max-w-4xl mx-auto px-8 py-24">
      <div className="text-center mb-16">
        <h1 className="text-5xl font-black mb-6 tracking-tighter uppercase">Frequently Asked <span className="text-emerald-500">Questions</span></h1>
        <p className="text-slate-400 text-lg">Everything you need to know about Verdiq.</p>
      </div>

      <div className="space-y-4">
        {faqs.map((faq, index) => (
          <div 
            key={index} 
            className={`bg-slate-900/50 border rounded-2xl overflow-hidden transition-all duration-300 ${
              openIndex === index ? 'border-emerald-500/50 bg-slate-900' : 'border-white/5 hover:border-white/10'
            }`}
          >
            <button 
              onClick={() => toggleFaq(index)}
              className="w-full flex items-center justify-between p-6 text-left focus:outline-none"
            >
              <h3 className={`text-xl font-bold transition-colors ${openIndex === index ? 'text-emerald-400' : 'text-white'}`}>
                {faq.question}
              </h3>
              {openIndex === index ? (
                <ChevronUp className="w-6 h-6 text-emerald-500" />
              ) : (
                <ChevronDown className="w-6 h-6 text-slate-500" />
              )}
            </button>
            <div 
              className={`transition-all duration-300 ease-in-out overflow-hidden ${
                openIndex === index ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
              }`}
            >
              <div className="p-6 pt-0 border-t border-white/5">
                <p className="text-slate-400 leading-relaxed">{faq.answer}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-16 text-center bg-slate-900 rounded-[40px] p-12 border border-white/10 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="relative z-10">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 text-emerald-500">
            <MessageCircle className="w-8 h-8" />
          </div>
          <h3 className="text-3xl font-black text-white mb-4 tracking-tight">Still have questions?</h3>
          <p className="text-slate-400 mb-8 max-w-md mx-auto">Our team is here to help you get the most out of Verdiq. Open a ticket in the Support Studio for direct assistance.</p>
          <button 
            onClick={onContactSupport}
            className="inline-flex items-center gap-3 bg-emerald-500 text-slate-950 px-10 py-4 rounded-2xl font-black hover:bg-emerald-400 transition-all hover:scale-105 shadow-xl shadow-emerald-500/20 uppercase tracking-widest text-sm"
          >
            Contact Support
          </button>
        </div>
      </div>
    </div>
  );
};

export default FAQ;

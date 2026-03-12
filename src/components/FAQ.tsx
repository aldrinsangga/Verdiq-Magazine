import React from 'react';

const FAQ = () => {
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
    }
  ];

  return (
    <div className="max-w-4xl mx-auto px-8 py-24">
      <div className="text-center mb-16">
        <h1 className="text-5xl font-black mb-6 tracking-tighter uppercase">Frequently Asked <span className="text-emerald-500">Questions</span></h1>
        <p className="text-slate-400 text-lg">Everything you need to know about Verdiq.</p>
      </div>

      <div className="space-y-6">
        {faqs.map((faq, index) => (
          <div key={index} className="bg-slate-900/50 border border-white/5 rounded-2xl p-6 hover:border-emerald-500/30 transition-colors">
            <h3 className="text-xl font-bold text-white mb-3">{faq.question}</h3>
            <p className="text-slate-400 leading-relaxed">{faq.answer}</p>
          </div>
        ))}
      </div>

      <div className="mt-16 text-center bg-slate-900 rounded-3xl p-8 border border-white/10">
        <h3 className="text-2xl font-bold text-white mb-4">Still have questions?</h3>
        <p className="text-slate-400 mb-6">Our team is here to help you get the most out of Verdiq.</p>
        <a href="mailto:verdiqmag@gmail.com" className="inline-block bg-emerald-500 text-slate-950 px-8 py-3 rounded-xl font-bold hover:bg-emerald-400 transition-colors">
          Contact Support
        </a>
      </div>
    </div>
  );
};

export default FAQ;

import React from 'react';

const PrivacyPolicy = () => {
  return (
    <div className="max-w-4xl mx-auto px-8 py-24">
      <h1 className="text-4xl font-black mb-8">Privacy Policy</h1>
      
      <div className="space-y-8 text-slate-300 leading-relaxed">
        <p>Last updated: March 10, 2026</p>

        <section>
          <h2 className="text-2xl font-bold text-white mb-4">1. Introduction</h2>
          <p>Welcome to Verdiq. We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you as to how we look after your personal data when you visit our website and tell you about your privacy rights and how the law protects you.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-white mb-4">2. The Data We Collect About You</h2>
          <p className="mb-4">We may collect, use, store and transfer different kinds of personal data about you which we have grouped together as follows:</p>
          <ul className="list-disc pl-6 space-y-2 text-slate-400">
            <li><strong>Identity Data</strong> includes first name, last name, username or similar identifier.</li>
            <li><strong>Contact Data</strong> includes email address.</li>
            <li><strong>Financial Data</strong> includes payment card details (processed securely by our third-party payment processors like Stripe or PayPal; we do not store full credit card numbers).</li>
            <li><strong>Transaction Data</strong> includes details about payments to and from you and other details of products and services you have purchased from us.</li>
            <li><strong>Content Data</strong> includes audio files, images, lyrics, and biographical text you upload to the platform for analysis.</li>
            <li><strong>Technical Data</strong> includes internet protocol (IP) address, your login data, browser type and version, time zone setting and location, browser plug-in types and versions, operating system and platform, and other technology on the devices you use to access this website.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-white mb-4">3. How We Use Your Personal Data</h2>
          <p className="mb-4">We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:</p>
          <ul className="list-disc pl-6 space-y-2 text-slate-400">
            <li>Where we need to perform the contract we are about to enter into or have entered into with you (e.g., providing AI analysis of your music).</li>
            <li>Where it is necessary for our legitimate interests (or those of a third party) and your interests and fundamental rights do not override those interests.</li>
            <li>Where we need to comply with a legal obligation.</li>
          </ul>
          <p className="mt-4"><strong>AI Processing:</strong> Your Content Data (audio, lyrics, bio) is processed using third-party AI services (specifically, Google Gemini API) to generate the reviews and podcasts. By uploading your content, you consent to this processing. We do not use your personal data to train our own foundational AI models.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-white mb-4">4. Data Security</h2>
          <p>We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used or accessed in an unauthorized way, altered or disclosed. In addition, we limit access to your personal data to those employees, agents, contractors and other third parties who have a business need to know. They will only process your personal data on our instructions and they are subject to a duty of confidentiality.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-white mb-4">5. Data Retention</h2>
          <p>We will only retain your personal data for as long as reasonably necessary to fulfill the purposes we collected it for, including for the purposes of satisfying any legal, regulatory, tax, accounting or reporting requirements. You may delete your account and associated data at any time by contacting support.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-white mb-4">6. Your Legal Rights</h2>
          <p className="mb-4">Under certain circumstances, you have rights under data protection laws in relation to your personal data, including the right to:</p>
          <ul className="list-disc pl-6 space-y-2 text-slate-400">
            <li>Request access to your personal data.</li>
            <li>Request correction of your personal data.</li>
            <li>Request erasure of your personal data.</li>
            <li>Object to processing of your personal data.</li>
            <li>Request restriction of processing your personal data.</li>
            <li>Request transfer of your personal data.</li>
            <li>Right to withdraw consent.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-white mb-4">7. Contact Us</h2>
          <p>If you have any questions about this privacy policy or our privacy practices, please contact us at:</p>
          <p className="mt-2 text-emerald-500 font-bold">verdiqmag@gmail.com</p>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPolicy;

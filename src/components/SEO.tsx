import React, { useEffect } from 'react';

interface SEOProps {
  view: string;
  currentReview?: any;
}

const SEO: React.FC<SEOProps> = ({ view, currentReview }) => {
  useEffect(() => {
    let title = 'Verdiq | AI-Powered Music Analysis';
    let description = 'Verdiq is an AI-powered music review and analysis platform for independent artists and producers.';
    let ogTitle = title;
    let ogDescription = description;
    let ogImage = 'https://picsum.photos/seed/verdiq/1200/630';
    let canonical = window.location.origin + window.location.pathname;

    if (view === 'review' && currentReview) {
      const artist = currentReview.artistName || 'Unknown Artist';
      const track = currentReview.trackName || 'Untitled Track';
      const score = currentReview.score || 'N/A';
      
      title = `${track} by ${artist} | Verdiq Music Review`;
      description = `Read the professional AI-powered editorial review of "${track}" by ${artist} on Verdiq. Spectral analysis score: ${score}/10.`;
      ogTitle = `Verdiq Review: ${track} by ${artist}`;
      ogDescription = `Check out the deep-dive analysis of ${artist}'s latest track "${track}". Industry-standard critique and spectral audit.`;
      
      if (currentReview.featuredPhoto) {
        ogImage = currentReview.featuredPhoto;
      }
    } else if (view === 'magazine') {
      title = 'Verdiq Magazine | Discover New Independent Music';
      description = 'Explore the latest independent tracks analyzed and reviewed by Verdiq AI. Discover your next favorite artist.';
    } else if (view === 'podcasts') {
      title = 'Verdiq Podcasts | Industry Debates on New Music';
      description = 'Listen to Wolf & Sloane debate the latest tracks in our AI-generated music industry podcast sessions.';
    } else if (view === 'pricing') {
      title = 'Verdiq Pricing | Studio Plans for Artists';
      description = 'Choose the right plan for your music career. Get professional reviews, podcasts, and technical audits.';
    } else if (view === 'landing') {
      title = 'Verdiq | Your Music, Immortalized by AI';
      description = 'Professional music reviews, spectral audits, and industry podcasts for independent artists. Submit your track today.';
    }

    // Update document title
    document.title = title;

    // Update meta tags
    const updateMetaTag = (name: string, content: string, property = false) => {
      const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
      let element = document.querySelector(selector);
      if (!element) {
        element = document.createElement('meta');
        if (property) {
          element.setAttribute('property', name);
        } else {
          element.setAttribute('name', name);
        }
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    updateMetaTag('description', description);
    updateMetaTag('og:title', ogTitle, true);
    updateMetaTag('og:description', ogDescription, true);
    updateMetaTag('og:image', ogImage, true);
    updateMetaTag('og:url', canonical, true);
    updateMetaTag('og:type', 'website', true);
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', ogTitle);
    updateMetaTag('twitter:description', ogDescription);
    updateMetaTag('twitter:image', ogImage);

    // Update JSON-LD structured data
    let script = document.getElementById('json-ld-seo') as HTMLScriptElement;
    if (!script) {
      script = document.createElement('script');
      script.id = 'json-ld-seo';
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }

    const structuredData: any = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "Verdiq",
      "url": window.location.origin
    };

    if (view === 'review' && currentReview) {
      const artist = currentReview.artistName || 'Unknown Artist';
      const track = currentReview.trackName || 'Untitled Track';
      
      structuredData["@type"] = "Review";
      structuredData["itemReviewed"] = {
        "@type": "MusicRecording",
        "name": track,
        "byArtist": {
          "@type": "MusicGroup",
          "name": artist
        }
      };
      structuredData["reviewRating"] = {
        "@type": "Rating",
        "ratingValue": currentReview.score || "8.5",
        "bestRating": "10"
      };
      structuredData["author"] = {
        "@type": "Organization",
        "name": "Verdiq AI"
      };
      structuredData["publisher"] = {
        "@type": "Organization",
        "name": "Verdiq",
        "logo": {
          "@type": "ImageObject",
          "url": `${window.location.origin}/logo.png`
        }
      };
      structuredData["headline"] = `${track} by ${artist} - AI Music Review`;
      structuredData["image"] = ogImage;
      structuredData["datePublished"] = currentReview.createdAt || new Date().toISOString();
    }

    script.text = JSON.stringify(structuredData);

    // Update canonical link
    let link: HTMLLinkElement | null = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', canonical);

  }, [view, currentReview]);

  return null;
};

export default SEO;

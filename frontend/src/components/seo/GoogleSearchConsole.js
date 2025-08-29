import React, { useEffect } from "react";

/**
 * GoogleSearchConsole Component
 * Adds Google Search Console verification meta tag to the app
 */
const GoogleSearchConsole = () => {
  // Replace this with your actual Google Search Console verification code
  const googleVerificationCode = "your-google-verification-code";

  useEffect(() => {
    // Find the Google verification meta tag or create it if it doesn't exist
    let metaVerification = document.querySelector(
      'meta[name="google-site-verification"]'
    );
    if (!metaVerification) {
      metaVerification = document.createElement("meta");
      metaVerification.name = "google-site-verification";
      document.head.appendChild(metaVerification);
    }
    metaVerification.content = googleVerificationCode;

    // Clean up function - no need to remove this meta tag
    return () => {};
  }, []);

  // Return null since we're modifying the document head directly
  return null;
};

export default GoogleSearchConsole;

import React from "react";
import { Helmet } from "react-helmet-async";

/**
 * GoogleSearchConsole Component
 * Adds Google Search Console verification meta tag to the app
 */
const GoogleSearchConsole = () => {
  // Replace this with your actual Google Search Console verification code
  const googleVerificationCode = "your-google-verification-code";

  return (
    <Helmet>
      <meta name="google-site-verification" content={googleVerificationCode} />
    </Helmet>
  );
};

export default GoogleSearchConsole;

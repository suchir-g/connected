import React, { useEffect } from "react";

/**
 * SEO Component for managing document head metadata
 *
 * @param {Object} props
 * @param {string} props.title - Page title
 * @param {string} props.description - Page description
 */
const SEO = ({
  title = "Connected - Chess Training and Community Platform",
  description = "Master chess with Connected - play against AI, track your progress, and connect with other players in a social chess community.",
}) => {
  useEffect(() => {
    // Update the document title
    document.title = title;

    // Find the description meta tag or create it if it doesn't exist
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement("meta");
      metaDescription.name = "description";
      document.head.appendChild(metaDescription);
    }
    metaDescription.content = description;

    // Clean up function
    return () => {
      // Don't remove the meta tag, but you could reset to a default if needed
    };
  }, [title, description]);

  // Return null since we're modifying the document head directly
  return null;
};

export default SEO;

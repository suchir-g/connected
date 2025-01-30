export const getFirebaseErrorMessage = (error) => {
  switch (error.code) {
    case "auth/invalid-credential":
      return "The email address is not valid. Please check and try again.";
    case "auth/user-disabled":
      return "This user account has been disabled. Please contact support.";
    case "auth/user-not-found":
      return "No account found with this email. Please register first.";
    case "auth/wrong-password":
      return "Incorrect password. Please try again.";
    case "auth/too-many-requests":
      return "Too many unsuccessful login attempts. Please try again later.";

    case "auth/email-already-in-use":
      return "This email is already in use. Please use a different email.";
    case "auth/invalid-password":
      return "The password is invalid. It must be at least 6 characters.";
    case "auth/operation-not-allowed":
      return "Email/password accounts are not enabled. Please contact support.";

    case "auth/invalid-action-code":
      return "The password reset link is invalid or has expired.";
    case "auth/user-token-expired":
      return "The password reset link has expired. Please request a new one.";

    case "auth/network-request-failed":
      return "Network error. Please check your internet connection and try again.";
    case "auth/unknown":
      return "An unknown error occurred. Please try again.";

    default:
      return "An unexpected error occurred. Please try again.";
  }
};

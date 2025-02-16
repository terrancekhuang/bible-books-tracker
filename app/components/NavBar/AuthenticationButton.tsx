import React from "react";
import { signIn } from "@/auth";

const AuthenticationButton = async () => {
  return (
    <>
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/" });
        }}
      >
        <button className="btn">Sign in</button>
      </form>
    </>
  );
};

export default AuthenticationButton;

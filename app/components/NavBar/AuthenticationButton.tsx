import React from "react";
import { auth, signIn } from "@/auth";
import ProfileDropDown from "./ProfileDropDown";

const AuthenticationButton = async () => {
  const session = await auth();
  const user = session?.user;

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

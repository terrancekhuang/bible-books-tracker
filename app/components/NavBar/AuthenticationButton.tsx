import React from "react";
import { auth, signIn } from "@/auth";
import { createUser } from "@/app/lib/queries";

const AuthenticationButton = async () => {
  return (
    <>
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/" });
          const session = await auth();
          if (session) await createUser(session.user?.name || "", session.user?.email || "")
        }}
      >
        <button className="btn">Sign in</button>
      </form>
    </>
  );
};

export default AuthenticationButton;

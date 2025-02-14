import { auth } from "@/auth";
import React from "react";
import NavBarButton from "./NavBarButton";
import AuthenticationButton from "./AuthenticationButton";

export default async function NavBar() {
  const session = await auth();
  return (
    <>
      <div className="navbar bg-base-300">
        <div className="navbar-start">
          <NavBarButton
            className="btn btn-ghost text-xl"
            buttonLabel="Bible Books Tracker"
            hrefLink="/"
          />
        </div>
        <div className="navbar-center hidden lg:flex">
          <ul className="menu menu-horizontal px-1 py-1">
            <NavBarButton
              buttonLabel="Progress"
              hrefLink={session ? "/" : "#"}
            />
            <NavBarButton
              buttonLabel="Profile"
              hrefLink={session ? "/stats" : "#"}
            />
          </ul>
        </div>
        <div className="navbar-end">
          <AuthenticationButton />
        </div>
      </div>
    </>
  );
}

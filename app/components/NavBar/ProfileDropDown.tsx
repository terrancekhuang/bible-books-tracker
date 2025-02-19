import React from "react";
import Link from "next/link";
import Image from "next/image";
import { signOut } from "@/auth";

type userProp = {
  image: string;
}

const ProfileDropDown = async ({image}: userProp) => {
  const userImageDimension = 52;

  return (
    <>
      <div className="dropdown dropdown-end">
        <div
          tabIndex={0}
          role="button"
          className="btn btn-ghost btn-circle avatar"
        >
          <div className="w-10 rounded-full">
            <Image alt="user image" src={image} width={userImageDimension} height={userImageDimension}/>
          </div>
        </div>
        <ul
          tabIndex={0}
          className={`menu menu-sm dropdown-content bg-base-100 rounded-box z-[1] mt-3 w-${userImageDimension} p-2 shadow w-max`}
        >
          <li>
            <Link href="/profile" className="justify-between">
              Profile
            </Link>
          </li>
          <li>
            <form
              action={async () => {
                "use server";
                await signOut();
              }}
            >
              <button>Sign out</button>
            </form>
          </li>
        </ul>
      </div>
    </>
  );
};

export default ProfileDropDown;

"use client";
import React from "react";
import Link from "next/link";

interface NavBarButtonProps {
  className?: string;
  buttonLabel: string;
  hrefLink?: string;
}

const NavBarButton = ({
  className,
  buttonLabel,
  hrefLink,
}: NavBarButtonProps) => {
  return (
    <li>
      <Link className={className} href={hrefLink!}>
        {buttonLabel}
      </Link>
    </li>
  );
};

export default NavBarButton;

"use client";
import React from "react";

interface NavBarButtonProps {
  className?: string;
  buttonLabel: string;
  hrefLink?: string;
}

const NavBarButton = ({className, buttonLabel, hrefLink}: NavBarButtonProps) => {
  return <li><a className={className} href={hrefLink}>{buttonLabel}</a></li>;
};

export default NavBarButton;

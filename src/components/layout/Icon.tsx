type IconName =
  | "activity"
  | "bell"
  | "calendar"
  | "check"
  | "chevron"
  | "clipboard"
  | "cloud"
  | "file"
  | "home"
  | "log-out"
  | "menu"
  | "send"
  | "settings"
  | "shield"
  | "students"
  | "upload"
  | "user";

type Props = {
  name: IconName;
  className?: string;
};

const paths: Record<IconName, string[]> = {
  activity: ["M4 12h4l2-7 4 14 2-7h4"],
  bell: ["M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7", "M10 19a2 2 0 0 0 4 0"],
  calendar: ["M8 2v4M16 2v4M3 10h18", "M5 4h14a2 2 0 0 1 2 2v13H3V6a2 2 0 0 1 2-2Z"],
  check: ["m5 12 4 4L19 6"],
  chevron: ["m6 9 6 6 6-6"],
  clipboard: ["M9 5h6", "M9 3h6v4H9z", "M6 5H5a2 2 0 0 0-2 2v12h18V7a2 2 0 0 0-2-2h-1"],
  cloud: ["M17.5 19H7a5 5 0 1 1 .9-9.9 7 7 0 0 1 13.2 3A3.5 3.5 0 0 1 17.5 19Z", "M12 12v6M9 15l3-3 3 3"],
  file: ["M14 2H6a2 2 0 0 0-2 2v16h16V8z", "M14 2v6h6", "M8 13h8M8 17h5"],
  home: ["M3 10.5 12 3l9 7.5", "M5 9.5V21h14V9.5", "M9 21v-6h6v6"],
  "log-out": ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "M16 17l5-5-5-5", "M21 12H9"],
  menu: ["M4 6h16M4 12h16M4 18h16"],
  send: ["M22 2 11 13", "m22 2-7 20-4-9-9-4z"],
  settings: ["M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z", "M4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4"],
  shield: ["M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z", "M9 12l2 2 4-5"],
  students: ["M16 11a4 4 0 1 0-8 0", "M3 21a7 7 0 0 1 14 0", "M18 8a3 3 0 0 1 0 6", "M19 17a5 5 0 0 1 2 4"],
  upload: ["M12 16V4", "m7 9 5-5 5 5", "M4 20h16"],
  user: ["M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z", "M3 22a9 9 0 0 1 18 0"],
};

export function Icon({ name, className = "h-5 w-5" }: Props) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name].map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}

import {
  faClock,
  faCommentAlt,
  faCommentDots,
  faStickyNote,
} from "@fortawesome/free-regular-svg-icons";
import {
  faChartLine,
  faInfo,
  faMosque,
  faSitemap,
  faUsers,
  faCalendar,
} from "@fortawesome/free-solid-svg-icons";
import { both, either, equals, has, hasPath, pipe, prop } from "ramda";

const isOrgExist = both(hasPath(["org", "type"]) && hasPath(["org", "id"]));
const isMosq = both(isOrgExist, pipe(prop("org"), prop("type"), equals("mosque")));

const isUnion = (user) => {
  return user && user.org && user.org.id && user.org.type && user.org.type === "union";
};

const isMosqOrUnion = both(isOrgExist, either(isMosq, isUnion));

const isEqual = (x, y) => x && y && x === y;

const isRoleExist = has("role");
const isMosqAdmin = (user) =>
  isRoleExist(user) &&
  isOrgExist(user) &&
  equals(user.role, "admin") &&
  equals(user.org.type, "mosque");
const isUnionAdmin = (user) =>
  isRoleExist(user) &&
  isOrgExist(user) &&
  equals(user.role, "admin") &&
  equals(user.org.type, "union");
const isSuperAdmin = (user) => isRoleExist(user) && equals(user.role, "superadmin");
const isMosqPublisher = (user) =>
  isOrgExist(user) &&
  isRoleExist(user) &&
  isEqual(user.role, "publisher") &&
  isEqual(user.org.type, "mosque");

const getMosqPublisherMenu = (user) => [
  {
    url: "/daily-notes",
    icon: faStickyNote,
    title: "dailyNotes",
    active: isOrgExist(user) && user.canEditNotes,
  },
  {
    url: "/times",
    icon: faClock,
    title: "prayerTimes",
    active: isOrgExist(user) && user.canEditPrayerTimes,
  },
  {
    url: "/posts",
    icon: faCommentAlt,
    title: "posts",
    active:
      isOrgExist(user) &&
      user.topics &&
      user.topics.length &&
      hasPath(["org", "permissions", "publications"])(user) &&
      user.org.permissions.publications,
  },
];

const getMosqAdminMenu = (user) => [
  {
    url: "/times",
    icon: faClock,
    title: "prayerTimes",
    active: isOrgExist(user),
  },
  {
    url: "/daily-notes",
    icon: faStickyNote,
    title: "dailyNotes",
    active: isOrgExist(user),
  },
  {
    url: "/posts",
    icon: faCommentAlt,
    title: "posts",
    active:
      isOrgExist(user) &&
      hasPath(["org", "permissions", "publications"])(user) &&
      user.org.permissions.publications,
  },
  {
    url: "/events",
    icon: faCalendar,
    title: "events",
    active: isOrgExist(user),
  },
  {
    url: "/statistics",
    icon: faChartLine,
    title: "statistics",
    active:
      isOrgExist(user) &&
      hasPath(["org", "permissions", "publications"])(user) &&
      user.org.permissions.publications,
  },
  {
    url: "/settings",
    icon: faInfo,
    title: "mosqueInfo",
    active: true,
  },
  {
    url: "/publishers",
    icon: faUsers,
    title: "publishers",
    active: isOrgExist(user),
  },
  {
    url: "/topics",
    icon: faCommentDots,
    title: "topics",
    active:
      isOrgExist(user) &&
      hasPath(["org", "permissions", "publications"])(user) &&
      user.org.permissions.publications,
  },
];

const getSuperAdminMenu = () => [
  {
    url: "/admins",
    icon: faUsers,
    title: "admins",
  },
  {
    url: "/mosques",
    icon: faMosque,
    title: "mosques",
  },
  {
    url: "/unions",
    icon: faSitemap,
    title: "unions",
  },
];

const getUnionAdminMenu = (user) => [
  {
    url: "/daily-notes",
    icon: faStickyNote,
    title: "dailyNotes",
    active: isOrgExist(user),
  },
  {
    url: "/posts",
    icon: faCommentAlt,
    title: "posts",
    active:
      isOrgExist(user) &&
      hasPath(["org", "permissions", "publications"])(user) &&
      user.org.permissions.publications,
  },
  {
    url: "/events",
    icon: faCalendar,
    title: "events",
    active: isOrgExist(user),
  },
  {
    url: "/statistics",
    icon: faChartLine,
    title: "statistics",
    active:
      isOrgExist(user) &&
      hasPath(["org", "permissions", "publications"])(user) &&
      user.org.permissions.publications,
  },
  {
    url: "/mosques",
    icon: faMosque,
    title: "mosques",
    active: isOrgExist(user),
  },
  {
    url: "/topics",
    icon: faCommentDots,
    title: "topics",
    active:
      isOrgExist(user) &&
      hasPath(["org", "permissions", "publications"])(user) &&
      user.org.permissions.publications,
  },
];

function redirectUserToAvailableRoute(user, goto) {
  let url = "/no-access";

  if (isMosq(user) && !isMosqPublisher(user)) {
    const menu = getMosqAdminMenu(user);
    const availableMenu = menu.find((opt) => opt.active);
    url = availableMenu?.url;
  } else if (isSuperAdmin(user)) {
    const menu = getSuperAdminMenu();
    const availableMenu = menu[0];
    url = availableMenu?.url;
  } else if (isUnionAdmin(user)) {
    const menu = getUnionAdminMenu(user);
    const availableMenu = menu.find((opt) => opt.active);
    url = availableMenu?.url;
  } else if (isMosqPublisher(user)) {
    const menu = getMosqPublisherMenu(user);
    const availableMenu = menu.find((opt) => opt.active);
    url = availableMenu?.url;
  }

  goto(url || "/no-access");
}

const isValidUser = (user) => {
  const isOrg = user.org && user.org.id && user.org.type;
  if (isOrg) {
    const isMosq = user.org.type === "mosque";
    const isUnion = user.org.type === "union";
    const isAdmin = user.role === "admin";
    const isPusblisher = user.role === "publisher";

    return (isMosq || isUnion) && (isAdmin || isPusblisher);
  } else {
    const isSuperadmin = user.role && user.role === "superadmin";
    if (isSuperadmin) {
      return true;
    }
  }
  return false;
};

function checkPageVisitPermsOrRedirect(user, types, goto) {
  console.log("checking visit perms for user", user, "for types", types);

  const perms = {
    publisher: hasPublisherRoutePermissions,
    admin: hasAdminRoutePermissions,
    superadmin: hasSuperAdminRoutePermissions,
    union: hasUnionRoutePermissions,
    mosque: hasMosqueAdminRoutePermissions,
  };

  const hasPerms = types.some((type) => perms[type](user));
  if (!hasPerms) {
    redirectUserToAvailableRoute(user, goto);
  }
  return hasPerms;
}

function hasPublisherRoutePermissions(user) {
  return (
    user &&
    hasPath(["org", "permissions", "adminPanel"])(user) &&
    user.org?.permissions?.adminPanel &&
    (user.role === "publisher" || user.role === "admin")
  );
}

function hasAdminRoutePermissions(user) {
  return user?.role === "admin" && user?.org?.permissions?.adminPanel;
}

function hasSuperAdminRoutePermissions(user) {
  return user?.role === "superadmin";
}

function hasMosqueAdminRoutePermissions(user) {
  return user?.role === "admin" && user?.org?.type === "mosque" && user.org.permissions?.adminPanel;
}

function hasUnionRoutePermissions(user) {
  return user?.role === "admin" && user?.org?.type === "union" && user.org.permissions?.adminPanel;
}

export {
  isEqual,
  isMosqAdmin,
  isMosqPublisher,
  isOrgExist,
  isMosqOrUnion,
  isSuperAdmin,
  isUnionAdmin,
  isMosq,
  isUnion,
  getMosqAdminMenu,
  getSuperAdminMenu,
  getUnionAdminMenu,
  getMosqPublisherMenu,
  redirectUserToAvailableRoute,
  isValidUser,
  hasPublisherRoutePermissions,
  hasAdminRoutePermissions,
  hasSuperAdminRoutePermissions,
  hasUnionRoutePermissions,
  checkPageVisitPermsOrRedirect,
};

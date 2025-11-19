import React, { useEffect, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { LayoutGrid, Settings as SettingsIcon, BoxSelect, Book } from 'lucide-react';
import { getExercises, getCourseNames } from '../services/db';

export const Sidebar = () => {
  const location = useLocation();
  const [courses, setCourses] = useState<string[]>([]);

  const refreshCourses = async () => {
    const exercises = await getExercises();
    setCourses(getCourseNames(exercises));
  };

  useEffect(() => {
    refreshCourses();
    window.addEventListener('vaulty-db-change', refreshCourses);
    return () => window.removeEventListener('vaulty-db-change', refreshCourses);
  }, []);

  const baseNavClass = "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 mb-1 cursor-pointer text-sm";
  const activeClass = "bg-neutral-200 text-neutral-900 font-medium shadow-sm dark:bg-neutral-800 dark:text-white";
  const inactiveClass = "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200";

  const getNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    `${baseNavClass} ${isActive ? activeClass : inactiveClass}`;

  const isCourseActive = (courseName: string) => {
    const params = new URLSearchParams(location.search);
    return location.pathname === '/database' && params.get('course') === courseName;
  };

  return (
    <aside className="w-64 h-full bg-neutral-50 border-r border-neutral-200 flex flex-col flex-shrink-0 z-20 dark:bg-neutral-900 dark:border-neutral-800">
      <div className="p-5 flex items-center gap-2">
        <div className="w-8 h-8 bg-neutral-900 rounded-lg flex items-center justify-center text-white dark:bg-white dark:text-black">
          <BoxSelect size={18} />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">Vaulty</h1>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <NavLink to="/extractor" className={getNavLinkClass}>
          <LayoutGrid size={18} />
          <span>Extractor</span>
        </NavLink>

        {courses.length > 0 && (
          <>
            <div className="mt-6 text-xs font-semibold text-neutral-400 uppercase tracking-wider px-3 mb-2 dark:text-neutral-500">
              Library
            </div>
            {courses.map(course => (
              <Link
                key={course}
                to={`/database?course=${encodeURIComponent(course)}`}
                className={`${baseNavClass} ${isCourseActive(course) ? activeClass : inactiveClass}`}
              >
                <Book size={18} />
                <span className="truncate">{course}</span>
              </Link>
            ))}
          </>
        )}
      </nav>

      <div className="p-3 border-t border-neutral-200 dark:border-neutral-800">
        <NavLink to="/settings" className={getNavLinkClass}>
          <SettingsIcon size={18} />
          <span>Settings</span>
        </NavLink>
      </div>
    </aside>
  );
};
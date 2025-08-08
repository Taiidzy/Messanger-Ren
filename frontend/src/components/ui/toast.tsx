/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { motion } from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Icons } from "./icons";

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-lg border p-6 pr-8 shadow-lg transition-all backdrop-blur-sm",
  {
    variants: {
      variant: {
        default: "bg-background/80 border-border/50",
        destructive:
          "border-red-500/50 bg-red-500/10 text-red-500 dark:border-red-500/50 dark:bg-red-500/10 dark:text-red-400",
        success:
          "border-emerald-500/50 bg-emerald-500/10 text-emerald-500 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-400",
        warning:
          "border-orange-500/50 bg-orange-500/10 text-orange-500 dark:border-orange-500/50 dark:bg-orange-500/10 dark:text-orange-400",
        info: "border-sky-500/50 bg-sky-500/10 text-sky-500 dark:border-sky-500/50 dark:bg-sky-500/10 dark:text-sky-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface ToastProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof toastVariants> {
  title?: string;
  description?: string;
  icon?: keyof typeof Icons;
  onClose?: () => void;
}

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  (
    { className, variant, title, description, icon, onClose, ...props },
    ref,
  ) => {
    const Icon = icon ? Icons[icon] : null;

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{
          opacity: 1,
          y: 0,
          scale: 1,
          transition: {
            type: "spring",
            stiffness: 500,
            damping: 30,
          },
        }}
        exit={{
          opacity: 0,
          scale: 0.95,
          transition: {
            duration: 0.2,
            ease: "easeInOut",
          },
        }}
        className={cn(toastVariants({ variant }), className)}
        {...(props as React.ComponentProps<typeof motion.div>)}
      >
        <div className="grid gap-1">
          {title && (
            <div className="text-sm font-semibold tracking-tight">{title}</div>
          )}
          {description && (
            <div className="text-sm opacity-90 leading-relaxed">
              {description}
            </div>
          )}
        </div>
        {Icon && (
          <div className="mr-4">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <button
          onClick={onClose}
          className="absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-all hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100 hover:bg-foreground/5"
        >
          <Icons.x className="h-4 w-4" />
        </button>
      </motion.div>
    );
  },
);
Toast.displayName = "Toast";

export { Toast, toastVariants };

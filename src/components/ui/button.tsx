import * as React from 'react';
import { Pressable, Text, View, ActivityIndicator } from 'react-native';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'flex-row items-center justify-center rounded-lg px-4 py-2 gap-2 active:opacity-70',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        destructive: 'bg-destructive text-destructive-foreground',
        outline: 'border border-primary bg-transparent',
        secondary: 'bg-secondary text-secondary-foreground',
        ghost: 'bg-transparent',
        link: 'bg-transparent',
      },
      size: {
        default: 'h-11 min-h-[44px]',
        sm: 'h-9 px-3 min-h-[36px]',
        lg: 'h-12 px-8 min-h-[48px]',
        icon: 'h-11 w-11 min-h-[44px] min-w-[44px]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const buttonTextVariants = cva('text-sm font-medium', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      destructive: 'text-destructive-foreground',
      outline: 'text-foreground',
      secondary: 'text-secondary-foreground',
      ghost: 'text-foreground',
      link: 'text-primary underline',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

interface ButtonProps
  extends React.ComponentPropsWithoutRef<typeof Pressable>,
    VariantProps<typeof buttonVariants> {
  label?: string;
  loading?: boolean;
}

function Button({ className, variant, size, label, children, loading, ...props }: ButtonProps) {
  return (
    <Pressable
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={loading}
      {...props}
    >
      {({ pressed }) => (
        <View className={cn("flex-row items-center gap-2", pressed && "opacity-70")}>
          {loading ? (
            <ActivityIndicator color={variant === 'default' ? '#fff' : '#000'} />
          ) : (
            <>
              {label && (
                <Text className={cn(buttonTextVariants({ variant }))}>{label}</Text>
              )}
              {children}
            </>
          )}
        </View>
      )}
    </Pressable>
  );
}

export { Button, buttonVariants };

import * as React from 'react';
import { View, Text } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

interface BadgeProps
  extends React.ComponentPropsWithoutRef<typeof View>,
    VariantProps<typeof badgeVariants> {
  label?: string;
}

function Badge({ className, variant, label, children, ...props }: BadgeProps) {
  return (
    <View className={cn(badgeVariants({ variant }), className)} {...props}>
      {label ? (
        <Text
          className={cn(
            'text-xs font-semibold',
            variant === 'default' && 'text-primary-foreground',
            variant === 'secondary' && 'text-secondary-foreground',
            variant === 'destructive' && 'text-destructive-foreground',
            variant === 'outline' && 'text-foreground'
          )}
        >
          {label}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

export { Badge, badgeVariants };

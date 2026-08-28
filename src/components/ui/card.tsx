import * as React from 'react';
import { View, Text } from 'react-native';
import { cn } from '@/lib/utils';

function Card({ className, ...props }: React.ComponentPropsWithoutRef<typeof View>) {
  return (
    <View
      className={cn('rounded-[10px] border border-border bg-card', className)}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentPropsWithoutRef<typeof View>) {
  return <View className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />;
}

function CardTitle({ className, ...props }: React.ComponentPropsWithoutRef<typeof Text>) {
  return (
    <Text
      className={cn('font-semibold leading-none tracking-tight text-foreground text-xl', className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentPropsWithoutRef<typeof Text>) {
  return <Text className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

function CardContent({ className, ...props }: React.ComponentPropsWithoutRef<typeof View>) {
  return <View className={cn('p-6 pt-0', className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentPropsWithoutRef<typeof View>) {
  return <View className={cn('flex flex-row items-center p-6 pt-0', className)} {...props} />;
}

function Skeleton({ className, ...props }: React.ComponentPropsWithoutRef<typeof View>) {
  return (
    <View
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, Skeleton };

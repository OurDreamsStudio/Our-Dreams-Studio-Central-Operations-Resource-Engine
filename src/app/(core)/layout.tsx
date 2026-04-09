import NavigationWrapper from '@/components/NavigationWrapper';

export default function CoreLayout({ children }: { children: React.ReactNode }) {
  return <NavigationWrapper>{children}</NavigationWrapper>;
}

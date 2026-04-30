import {
  Route,
  Database,
  Zap,
  Shield,
  Palette,
  Code,
  Server,
  Layers,
  type LucideIcon,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useT } from "@/lib/i18n/useT"

// Icons keyed by the stable `key` field on each feature item in the i18n
// messages. This avoids silent icon/feature mismatches when translations
// reorder the items array.
const FEATURE_ICONS: Record<string, LucideIcon> = {
  router: Route,
  query: Database,
  react: Code,
  vite: Zap,
  typescript: Shield,
  tailwind: Palette,
  ssr: Server,
  shadcn: Layers,
};

export function FeaturesSection() {
  const { messages } = useT();
  const feat = messages.Landing?.Features;
  const items = feat?.items as Array<{ key: string; title: string; description: string; badge: string }> | undefined;

  return (
    <section id="features" className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {feat?.title ?? "Everything you need to build modern web apps"}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {feat?.subtitle ?? "A carefully curated stack of the best tools and libraries for React development"}
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-6 sm:mt-20 lg:mx-0 lg:max-w-none lg:grid-cols-2 xl:grid-cols-4">
          {(items ?? []).map((feature) => {
            const IconComponent = FEATURE_ICONS[feature.key] ?? Layers;
            return (
              <Card key={feature.key} className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <IconComponent className="h-5 w-5 text-primary" />
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {feature.badge}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}

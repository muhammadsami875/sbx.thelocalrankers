"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { requestPasswordReset } from "@/app/(auth)/actions";

const schema = z.object({ email: z.string().email("Enter a valid email address") });

export function ForgotPasswordForm() {
  const [sent, setSent] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  if (sent) {
    return (
      <div className="flex items-start gap-3 rounded-md border border-success/30 bg-success/10 p-4 text-sm">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
        <p className="leading-relaxed">
          If an account exists for that address, a reset link is on its way.
          The link expires in one hour.
        </p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(async (values) => {
          setPending(true);
          await requestPasswordReset(values.email);
          setPending(false);
          // Always report success — revealing which emails exist would let
          // anyone enumerate our user list.
          setSent(true);
        })}
        className="space-y-4"
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="you@thelocalrankers.com"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Send reset link
        </Button>
      </form>
    </Form>
  );
}

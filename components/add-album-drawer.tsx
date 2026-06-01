"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VinylSpinner } from "@/components/vinyl-spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const albumSchema = z.object({
  title: z.string().min(1, "Title is required"),
  artist: z.string().min(1, "Artist is required"),
  genre: z.string().optional(),
  condition: z.enum(["Mint", "Great", "Good", "Fair", "Poor"]),
  catalog_number: z.string().optional(),
  purchase_price: z.coerce.number().optional(),
  notes: z.string().optional(),
});

type AlbumFormData = z.infer<typeof albumSchema>;

interface AddAlbumDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddAlbumDrawer({ open, onOpenChange }: AddAlbumDrawerProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<AlbumFormData>({
    resolver: zodResolver(albumSchema),
    defaultValues: { condition: "Great" },
  });

  async function onSubmit(data: AlbumFormData) {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast.error("You must be logged in");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("albums").insert({
      user_id: user.id,
      title: data.title,
      artist: data.artist,
      genre: data.genre || null,
      condition: data.condition,
      catalog_number: data.catalog_number || null,
      purchase_price: data.purchase_price || null,
      notes: data.notes || null,
      status: "unlisted",
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Album added to catalogue");
      reset();
      onOpenChange(false);
      router.refresh();
    }
    setLoading(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Add Album</SheetTitle>
          <SheetDescription>
            Manually add a vinyl record to your catalogue.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...register("title")} placeholder="Kind of Blue" />
            {errors.title && (
              <p className="text-xs text-red-400">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="artist">Artist</Label>
            <Input id="artist" {...register("artist")} placeholder="Miles Davis" />
            {errors.artist && (
              <p className="text-xs text-red-400">{errors.artist.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="genre">Genre</Label>
            <Input id="genre" {...register("genre")} placeholder="Jazz" />
          </div>

          <div className="space-y-2">
            <Label>Condition</Label>
            <Select
              defaultValue="Great"
              onValueChange={(v) =>
                setValue("condition", v as AlbumFormData["condition"])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["Mint", "Great", "Good", "Fair", "Poor"] as const).map(
                  (c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="catalog_number">Catalog #</Label>
            <Input
              id="catalog_number"
              {...register("catalog_number")}
              placeholder="CL 1355"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="purchase_price">Purchase Price</Label>
            <Input
              id="purchase_price"
              type="number"
              step="0.01"
              {...register("purchase_price")}
              placeholder="0.00"
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <VinylSpinner size="xs" />
                Adding...
              </>
            ) : (
              "Add Album"
            )}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

import { useState } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/Dialog';
import { Popover, PopoverContent, PopoverTrigger } from './ui/Popover';
import { Avatar, AvatarFallback, AvatarImage } from './ui/Avatar';
import { ScrollArea } from './ui/ScrollArea';
import { Separator } from './ui/Separator';
import { Search, User, Settings, MessageCircle } from 'lucide-react';

export function ShadcnDemo() {
  const [inputValue, setInputValue] = useState('');

  return (
    <div className="p-8 space-y-8 max-w-4xl mx-auto">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground mb-2">Shadcn/UI Demo</h1>
        <p className="text-muted-foreground">Testing all shadcn/ui components</p>
      </div>

      <Separator />

      {/* Buttons */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Buttons</h2>
        <div className="flex flex-wrap gap-2">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
          <Button size="icon">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Separator />

      {/* Input */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Input</h2>
        <div className="space-y-2 max-w-md">
          <Input 
            placeholder="Type something..." 
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search..." className="pl-10" />
          </div>
        </div>
      </div>

      <Separator />

      {/* Avatar */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Avatar</h2>
        <div className="flex gap-4 items-center">
          <Avatar>
            <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
            <AvatarFallback>CN</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarFallback>
              <User className="w-4 h-4" />
            </AvatarFallback>
          </Avatar>
          <Avatar className="w-16 h-16">
            <AvatarFallback className="text-lg">LG</AvatarFallback>
          </Avatar>
        </div>
      </div>

      <Separator />

      {/* Dialog */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Dialog</h2>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Open Dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Are you absolutely sure?</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-muted-foreground">
                This action cannot be undone. This will permanently delete your account
                and remove your data from our servers.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline">Cancel</Button>
              <Button variant="destructive">Delete</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Separator />

      {/* Popover */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Popover</h2>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">Open Popover</Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-2">
              <h4 className="font-medium leading-none">Dimensions</h4>
              <p className="text-sm text-muted-foreground">
                Set the dimensions for the layer.
              </p>
              <div className="grid gap-2">
                <div className="grid grid-cols-3 items-center gap-4">
                  <label htmlFor="width" className="text-sm font-medium">Width</label>
                  <Input id="width" defaultValue="100%" className="col-span-2 h-8" />
                </div>
                <div className="grid grid-cols-3 items-center gap-4">
                  <label htmlFor="height" className="text-sm font-medium">Height</label>
                  <Input id="height" defaultValue="25px" className="col-span-2 h-8" />
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <Separator />

      {/* ScrollArea */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">ScrollArea</h2>
        <ScrollArea className="h-72 w-48 rounded-md border p-4">
          <div className="space-y-2">
            {Array.from({ length: 50 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded hover:bg-accent">
                <MessageCircle className="w-4 h-4" />
                <span className="text-sm">Item {i + 1}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      <Separator />

      {/* Colors Demo */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Color System</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <div className="w-full h-12 bg-background border rounded"></div>
            <p className="text-xs text-center">background</p>
          </div>
          <div className="space-y-2">
            <div className="w-full h-12 bg-foreground rounded"></div>
            <p className="text-xs text-center">foreground</p>
          </div>
          <div className="space-y-2">
            <div className="w-full h-12 bg-primary rounded"></div>
            <p className="text-xs text-center">primary</p>
          </div>
          <div className="space-y-2">
            <div className="w-full h-12 bg-secondary rounded"></div>
            <p className="text-xs text-center">secondary</p>
          </div>
          <div className="space-y-2">
            <div className="w-full h-12 bg-muted rounded"></div>
            <p className="text-xs text-center">muted</p>
          </div>
          <div className="space-y-2">
            <div className="w-full h-12 bg-accent rounded"></div>
            <p className="text-xs text-center">accent</p>
          </div>
          <div className="space-y-2">
            <div className="w-full h-12 bg-destructive rounded"></div>
            <p className="text-xs text-center">destructive</p>
          </div>
          <div className="space-y-2">
            <div className="w-full h-12 bg-border border-2 rounded"></div>
            <p className="text-xs text-center">border</p>
          </div>
        </div>
      </div>
    </div>
  );
}
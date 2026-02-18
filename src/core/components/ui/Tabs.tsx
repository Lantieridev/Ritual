'use client'

import { cn } from '@/src/core/lib/utils'

interface Tab {
    id: string
    label: string
}

interface TabsProps {
    tabs: Tab[]
    activeTab: string
    onChange: (id: string) => void
    className?: string
}

export function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
    return (
        <div className={cn('flex space-x-1 rounded-xl bg-white/5 p-1', className)}>
            {tabs.map((tab) => {
                const isActive = activeTab === tab.id
                return (
                    <button
                        key={tab.id}
                        onClick={() => onChange(tab.id)}
                        className={cn(
                            'relative rounded-lg px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-2',
                            isActive ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                        )}
                    >
                        {tab.label}
                    </button>
                )
            })}
        </div>
    )
}

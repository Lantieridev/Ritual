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
        <div className={cn('flex gap-1 bg-ritual-surface p-1', className)}>
            {tabs.map((tab) => {
                const isActive = activeTab === tab.id
                return (
                    <button
                        key={tab.id}
                        onClick={() => onChange(tab.id)}
                        className={cn(
                            'relative px-3 py-1.5 font-label text-[10px] tracking-[0.12em] uppercase transition-all focus-visible:outline-2',
                            isActive ? 'bg-ritual-red text-ritual-bone' : 'text-ritual-gray-text hover:text-ritual-gray-light hover:bg-ritual-surface-high'
                        )}
                    >
                        {tab.label}
                    </button>
                )
            })}
        </div>
    )
}

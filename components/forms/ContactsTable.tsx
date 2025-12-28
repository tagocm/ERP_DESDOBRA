import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Plus, Trash2, Check, Edit2, Users, Save } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/Dialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

export interface ContactFormData {
    id?: string
    full_name: string
    email: string
    phone: string
    departments: string[]
    notes: string
    is_primary: boolean
}

interface ContactsTableProps {
    contacts: ContactFormData[]
    onAdd: (contact: ContactFormData) => void
    onEdit: (id: string, contact: ContactFormData) => void
    onRemove: (id: string) => void
}

export function ContactsTable({ contacts, onAdd, onEdit, onRemove }: ContactsTableProps) {
    const [showForm, setShowForm] = useState(false)
    const [editingContact, setEditingContact] = useState<ContactFormData | null>(null)

    const handleSave = () => {
        if (!editingContact?.full_name) {
            alert("Nome é obrigatório")
            return
        }

        if (editingContact.id) {
            onEdit(editingContact.id, editingContact)
        } else {
            onAdd({ ...editingContact, id: `temp-${Date.now()}` })
        }

        setEditingContact(null)
        setShowForm(false)
    }

    const handleAddNew = () => {
        setEditingContact({
            id: undefined,
            full_name: "",
            email: "",
            phone: "",
            departments: [],
            notes: "",
            is_primary: contacts.length === 0
        })
        setShowForm(true)
    }

    const handleEditExisting = (contact: ContactFormData) => {
        setEditingContact(contact)
        setShowForm(true)
    }

    const handleCancel = () => {
        setEditingContact(null)
        setShowForm(false)
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between py-2">
                <p className="text-sm font-medium text-gray-500">
                    {contacts.length === 0 ? "Nenhum contato" : `${contacts.length} contato(s)`}
                </p>
                {!showForm && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddNew}
                        className="bg-white hover:bg-gray-50 text-gray-700 border-gray-200 shadow-sm rounded-lg h-9 px-4 font-medium transition-all active:scale-95"
                    >
                        <Plus className="w-4 h-4 mr-2 text-gray-500" />
                        Adicionar Contato
                    </Button>
                )}
            </div>

            {/* Contacts Table (True Gold Standard) */}
            {contacts.length > 0 && !showForm && (
                <div className="overflow-hidden border border-gray-200 rounded-2xl bg-white shadow-sm">
                    <Table>
                        <TableHeader className="bg-gray-50/50">
                            <TableRow className="hover:bg-transparent border-gray-100">
                                <TableHead className="px-6 h-10 text-xs font-bold text-gray-500 uppercase tracking-wider w-full">Contato</TableHead>
                                <TableHead className="px-6 h-10 text-xs font-bold text-gray-500 uppercase tracking-wider text-right pr-6">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {contacts.map((contact, idx) => (
                                <TableRow key={contact.id || idx} className="group border-gray-50 hover:bg-gray-50/50 transition-colors">
                                    <TableCell className="px-6 py-4">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-9 w-9 bg-brand-50 rounded-xl flex items-center justify-center text-brand-600 shadow-sm border border-brand-100/50">
                                                <Users className="w-5 h-5" />
                                            </div>
                                            <div className="ml-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="text-sm font-bold text-gray-900 leading-tight uppercase tracking-wide">
                                                        {contact.full_name}
                                                    </div>
                                                    {contact.is_primary && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100/50 uppercase tracking-wider">
                                                            <Check className="w-3 h-3" />
                                                            Principal
                                                        </span>
                                                    )}
                                                </div>
                                                {(contact.departments && contact.departments.length > 0) ? (
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {contact.departments.slice(0, 3).map(dept => (
                                                            <span key={dept} className="text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                                                {dept}
                                                            </span>
                                                        ))}
                                                        {contact.departments.length > 3 && (
                                                            <span className="text-[10px] font-medium text-gray-400 pl-1">
                                                                (+{contact.departments.length - 3})
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="text-[11px] font-medium text-gray-400 mt-0.5">
                                                        {contact.email || "Sem e-mail"}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-6 py-4 text-right pr-6">
                                        <div className="flex justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-lg hover:bg-brand-50 hover:text-brand-600 text-gray-400 transition-colors"
                                                onClick={() => handleEditExisting(contact)}
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-lg hover:bg-red-50 hover:text-red-600 text-gray-400 transition-colors"
                                                onClick={() => onRemove(contact.id!)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            {/* Contact Form Modal - True Gold Standard */}
            <Dialog open={showForm} onOpenChange={(open) => !open && handleCancel()}>
                <DialogContent className="max-w-[640px] w-full p-0 gap-0 bg-gray-50 overflow-hidden rounded-2xl border-0 shadow-2xl">
                    {/* Header: White Background with Title, Description and Primary Action */}
                    <div className="bg-white px-6 py-4 border-b border-gray-100 flex justify-between items-center sticky top-0 z-10">
                        <div>
                            <DialogTitle className="text-xl font-bold text-gray-900 leading-tight">
                                {editingContact?.id && !editingContact.id.startsWith('temp-') ? 'Editar Contato' : 'Novo Contato'}
                            </DialogTitle>
                            <DialogDescription className="text-sm text-gray-400 mt-1 font-medium">
                                Gerencie as informações detalhadas e departamentos do contato.
                            </DialogDescription>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={handleCancel}
                                className="rounded-xl hover:bg-gray-100 text-gray-500 font-semibold"
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="button"
                                onClick={handleSave}
                                className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-lg shadow-brand-200 px-6 h-10 transition-all font-bold active:scale-95 flex items-center gap-2"
                            >
                                <Save className="w-4 h-4" />
                                {editingContact?.id && !editingContact.id.startsWith('temp-') ? 'Salvar Alterações' : 'Confirmar Contato'}
                            </Button>
                        </div>
                    </div>

                    <div className="p-5 overflow-y-auto max-h-[75vh]">
                        {editingContact && (
                            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-5">
                                <section>
                                    <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2.5 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                                        Informações Básicas
                                    </h4>
                                    <div className="grid grid-cols-12 gap-4">
                                        <div className="col-span-12 md:col-span-6 space-y-1.5">
                                            <label className="text-xs font-bold text-gray-500 ml-1">Nome Completo *</label>
                                            <Input
                                                className="h-10 rounded-xl border-gray-200 focus:border-brand-500 focus:ring-brand-500 transition-all bg-gray-50/30 font-medium"
                                                value={editingContact.full_name}
                                                onChange={(e) => setEditingContact({ ...editingContact, full_name: e.target.value })}
                                                placeholder="Nome do contato"
                                            />
                                        </div>
                                        <div className="col-span-12 md:col-span-6 space-y-1.5">
                                            <label className="text-xs font-bold text-gray-500 ml-1">E-mail</label>
                                            <Input
                                                type="email"
                                                className="h-10 rounded-xl border-gray-200 focus:border-brand-500 focus:ring-brand-500 transition-all bg-gray-50/30 font-medium"
                                                value={editingContact.email}
                                                onChange={(e) => setEditingContact({ ...editingContact, email: e.target.value })}
                                                placeholder="exemplo@empresa.com"
                                            />
                                        </div>
                                        <div className="col-span-12 md:col-span-6 space-y-1.5">
                                            <label className="text-xs font-bold text-gray-500 ml-1">Telefone / WhatsApp</label>
                                            <Input
                                                className="h-10 rounded-xl border-gray-200 focus:border-brand-500 focus:ring-brand-500 transition-all bg-gray-50/30 font-medium"
                                                value={editingContact.phone}
                                                onChange={(e) => setEditingContact({ ...editingContact, phone: e.target.value })}
                                                placeholder="(00) 00000-0000"
                                            />
                                        </div>
                                        <div className="col-span-12 md:col-span-6 flex items-end pb-1">
                                            <label className="flex items-center gap-3 cursor-pointer group bg-gray-50/50 hover:bg-brand-50/50 px-4 py-2 rounded-xl border border-gray-100 hover:border-brand-100 transition-all w-full h-10">
                                                <input
                                                    type="checkbox"
                                                    checked={editingContact.is_primary}
                                                    onChange={(e) => setEditingContact({ ...editingContact, is_primary: e.target.checked })}
                                                    className="w-4 h-4 text-brand-600 rounded-lg border-gray-300 focus:ring-brand-500 transition-all cursor-pointer"
                                                />
                                                <span className="text-xs font-bold text-gray-600 group-hover:text-brand-700 transition-colors">Contato Principal</span>
                                            </label>
                                        </div>
                                    </div>
                                </section>

                                <section>
                                    <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2.5 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                                        Departamentos e Alocação
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {["Comercial", "Financeiro", "Compras", "Logística", "Fiscal", "Direção", "Outros"].map((dept) => (
                                            <label
                                                key={dept}
                                                className={cn(
                                                    "flex items-center gap-1.5 cursor-pointer px-3 py-1.5 rounded-lg border transition-all text-xs font-bold",
                                                    editingContact.departments?.includes(dept)
                                                        ? "bg-brand-600 text-white border-brand-600 shadow-sm shadow-brand-100"
                                                        : "bg-white text-gray-500 border-gray-200 hover:border-brand-300 hover:bg-brand-50/30"
                                                )}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={editingContact.departments?.includes(dept)}
                                                    onChange={(e) => {
                                                        const current = editingContact.departments || [];
                                                        const updated = e.target.checked
                                                            ? [...current, dept]
                                                            : current.filter(d => d !== dept);
                                                        setEditingContact({ ...editingContact, departments: updated });
                                                    }}
                                                    className="hidden"
                                                />
                                                {dept}
                                            </label>
                                        ))}
                                    </div>
                                </section>

                                <section>
                                    <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2.5 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                                        Observações Adicionais
                                    </h4>
                                    <textarea
                                        value={editingContact.notes}
                                        onChange={(e) => setEditingContact({ ...editingContact, notes: e.target.value })}
                                        rows={2}
                                        className="flex w-full rounded-2xl border border-gray-200 bg-gray-50/30 px-4 py-3 text-sm font-medium ring-offset-background placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 transition-all shadow-sm resize-none"
                                        placeholder="Algum detalhe relevante sobre este contato?"
                                    />
                                </section>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

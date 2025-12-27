
import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Plus, Trash2, Check, Edit2 } from "lucide-react"

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
            <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                    {contacts.length === 0 ? "Nenhum contato adicionado" : `${contacts.length} contato(s)`}
                </p>
                {!showForm && (
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleAddNew}
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Adicionar Contato
                    </Button>
                )}
            </div>

            {/* Contacts List */}
            {contacts.length > 0 && !showForm && (
                <div className="space-y-2">
                    {contacts.map(contact => (
                        <div key={contact.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">{contact.full_name}</span>
                                    {contact.is_primary && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-brand-100 text-brand-800">
                                            <Check className="w-3 h-3 mr-1" />
                                            Principal
                                        </span>
                                    )}
                                </div>
                                <div className="text-sm text-gray-600">
                                    {contact.email && <span>{contact.email}</span>}
                                    {contact.email && contact.phone && <span className="mx-2">•</span>}
                                    {contact.phone && <span>{contact.phone}</span>}
                                </div>
                                {contact.departments && contact.departments.length > 0 && (
                                    <div className="flex gap-1 flex-wrap mt-1">
                                        {contact.departments.map(dept => (
                                            <span key={dept} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                                {dept}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {contact.notes && <p className="text-xs text-gray-500 mt-1">{contact.notes}</p>}
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditExisting(contact)}
                                >
                                    <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-600 hover:text-red-700"
                                    onClick={() => onRemove(contact.id!)}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Contact Form */}
            {showForm && editingContact && (
                <div className="border rounded-lg p-4 space-y-4 bg-white">
                    <h4 className="font-medium">
                        {editingContact.id ? 'Editar Contato' : 'Novo Contato'}
                    </h4>
                    <div className="grid grid-cols-12 gap-3">
                        <div className="col-span-12 md:col-span-5 space-y-1.5">
                            <label className="text-xs font-medium text-gray-700">Nome *</label>
                            <Input
                                className="h-9"
                                value={editingContact.full_name}
                                onChange={(e) => setEditingContact({ ...editingContact, full_name: e.target.value })}
                                placeholder="Nome completo"
                            />
                        </div>
                        <div className="col-span-12 md:col-span-4 space-y-1.5">
                            <label className="text-xs font-medium text-gray-700">Email</label>
                            <Input
                                type="email"
                                className="h-9"
                                value={editingContact.email}
                                onChange={(e) => setEditingContact({ ...editingContact, email: e.target.value })}
                                placeholder="email@exemplo.com"
                            />
                        </div>
                        <div className="col-span-12 md:col-span-3 space-y-1.5">
                            <label className="text-xs font-medium text-gray-700">Telefone</label>
                            <Input
                                className="h-9"
                                value={editingContact.phone}
                                onChange={(e) => setEditingContact({ ...editingContact, phone: e.target.value })}
                                placeholder="(11) 98765-4321"
                            />
                        </div>

                        <div className="col-span-12 md:col-span-9 space-y-1.5">
                            <label className="text-xs font-medium text-gray-700">Departamentos</label>
                            <div className="flex flex-wrap gap-2">
                                {["Comercial", "Financeiro", "Compras", "Logística", "Fiscal", "Direção", "Outros"].map((dept) => (
                                    <label key={dept} className="flex items-center gap-1.5 cursor-pointer bg-gray-50 px-2 py-1 rounded border border-gray-100 hover:bg-gray-100 transition-colors">
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
                                            className="w-3.5 h-3.5 text-brand-600 rounded focus:ring-brand-500"
                                        />
                                        <span className="text-xs text-gray-700">{dept}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="col-span-12 md:col-span-3 flex items-end pb-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={editingContact.is_primary}
                                    onChange={(e) => setEditingContact({ ...editingContact, is_primary: e.target.checked })}
                                    className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                                />
                                <span className="text-sm font-medium text-gray-700">Contato Principal</span>
                            </label>
                        </div>

                        <div className="col-span-12 space-y-1.5">
                            <label className="text-xs font-medium text-gray-700">Observações</label>
                            <textarea
                                value={editingContact.notes}
                                onChange={(e) => setEditingContact({ ...editingContact, notes: e.target.value })}
                                rows={2}
                                className="flex w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 transition-all shadow-sm resize-none"
                                placeholder="Ex: Comprador, Financeiro, etc."
                            />
                        </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={handleCancel}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSave}
                        >
                            {editingContact.id ? 'Salvar' : 'Adicionar'}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}

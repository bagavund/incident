<?php

namespace App\Http\Resources;

use App\Models\IncidentAudit;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin IncidentAudit */
class IncidentAuditResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'action' => $this->action,
            'incident_code' => $this->incident_code,
            'incident_title' => $this->incident_title,
            'user' => $this->user ? ['id' => $this->user->id, 'name' => $this->user->name] : null,
            'changes' => $this->changes,
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}
